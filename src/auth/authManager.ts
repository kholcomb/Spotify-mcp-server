import { createHash, randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'crypto';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import axios from 'axios';
import { z } from 'zod';
import type { Logger } from '../types/index.js';
import { HSMManager, HSMConfigurations, createHSMManager, type HSMAuditEntry } from '../security/hsmManager.js';
import { RedirectUriValidator, type SecurityConfig } from '../config/security.js';
import { createScopeManager, type ScopeManager } from '../security/scopeManager.js';

/**
 * OAuth 2.0 authentication manager with PKCE flow for Spotify API
 * 
 * Implements secure authentication flow with encrypted token storage
 * and automatic token refresh capabilities.
 */
export class AuthManager {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly logger: Logger;
  private readonly tokenDir: string;
  private readonly encryptionKey: Buffer;
  private readonly salt: Buffer;
  private readonly hsmManager: HSMManager;
  private hsmEncryptionKeyId?: string;
  private readonly redirectUriValidator: RedirectUriValidator;
  private readonly scopeManager: ScopeManager;
  
  private static readonly SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
  private static readonly SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
  // Dynamic scopes based on security tier - will be set by scope manager
  private readonly dynamicScopes: string;

  constructor(config: AuthConfig, logger: Logger) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.logger = logger;
    this.tokenDir = join(homedir(), '.spotify-mcp');
    this.salt = this.getOrCreateSalt();
    this.encryptionKey = this.deriveEncryptionKey(config.clientSecret, this.salt);
    
    // Initialize secure redirect URI validator
    const environment = process.env.NODE_ENV === 'production' ? 'production' 
                      : process.env.NODE_ENV === 'staging' ? 'staging' 
                      : 'development';
    const securityConfig: SecurityConfig = {
      redirectUri: {
        uri: config.redirectUri,
        enforceHttps: environment === 'production',
        allowedDomains: config.allowedDomains || [],
        allowLocalhost: environment === 'development',
        allowedSchemes: environment === 'production' ? ['https'] : ['http', 'https']
      },
      environment,
      strictMode: environment === 'production'
    };
    this.redirectUriValidator = new RedirectUriValidator(securityConfig, logger);
    
    // Validate redirect URI on initialization
    this.validateRedirectUriSecurity();
    
    // Initialize HSM manager for enterprise-grade key management
    this.hsmManager = createHSMManager(
      HSMConfigurations.autoDetect(),
      logger,
      {
        enableAuditLogging: true,
        requireHardwareHSM: process.env.NODE_ENV === 'production' && process.env.REQUIRE_HARDWARE_HSM === 'true',
      }
    );
    
    // Initialize scope manager with appropriate tier
    const scopeTier = process.env.OAUTH_SCOPE_TIER as 'read-only' | 'limited' | 'full-access' || 
                     (environment === 'production' ? 'read-only' : 'limited');
    
    this.scopeManager = createScopeManager(scopeTier, logger);
    this.dynamicScopes = this.scopeManager.getScopeString();
    
    // Log scope configuration
    logger.info('OAuth scope configuration initialized', {
      tier: scopeTier,
      scopes: this.dynamicScopes,
      environment,
    });
    
    this.ensureTokenDirectory();
    this.initializeHSM().catch(err => {
      logger.warn('HSM initialization failed, falling back to software encryption', {
        error: err.message,
      });
    });
  }

  /**
   * Validate redirect URI security according to Spotify guidelines
   */
  private validateRedirectUriSecurity(): void {
    const validation = this.redirectUriValidator.validateRedirectUri(this.redirectUri);
    
    if (!validation.valid) {
      const errorMessage = `Insecure redirect URI configuration: ${validation.errors.join(', ')}`;
      this.logger.error('Redirect URI security validation failed', {
        uri: `${this.redirectUri.substring(0, 50)}...`,
        errors: validation.errors,
        warnings: validation.warnings
      });
      throw new AuthError(errorMessage, { retryable: false });
    }
    
    if (validation.warnings.length > 0) {
      this.logger.warn('Redirect URI security warnings', {
        uri: `${this.redirectUri.substring(0, 50)}...`,
        warnings: validation.warnings
      });
    }
  }

  /**
   * Initialize HSM for enterprise-grade key management
   */
  private async initializeHSM(): Promise<void> {
    try {
      await this.hsmManager.initialize();
      
      // Create or retrieve HSM encryption key
      const existingKeys = await this.hsmManager.listKeys();
      const spotifyKey = existingKeys.find(key => 
        key.attributes?.purpose === 'spotify-token-encryption'
      );
      
      if (spotifyKey) {
        this.hsmEncryptionKeyId = spotifyKey.keyId;
        this.logger.info('Using existing HSM encryption key for token storage', {
          keyId: spotifyKey.keyId,
          created: spotifyKey.created,
        });
      } else {
        this.hsmEncryptionKeyId = await this.hsmManager.createEncryptionKey('aes-256-gcm', {
          purpose: 'spotify-token-encryption',
          application: 'spotify-mcp-server',
          rotationInterval: '90d',
        });
        this.logger.info('Created new HSM encryption key for token storage', {
          keyId: this.hsmEncryptionKeyId,
        });
      }
    } catch (error) {
      this.logger.warn('HSM initialization failed, using software encryption', {
        error: error instanceof Error ? error.message : 'Unknown error',
        hsmProvider: this.hsmManager.getProviderInfo(),
      });
      throw error;
    }
  }

  /**
   * Get HSM audit log for security monitoring
   */
  getHSMAuditLog(limit?: number): HSMAuditEntry[] {
    return this.hsmManager.getAuditLog(limit);
  }

  /**
   * Check if HSM is available and hardware-based
   */
  isHardwareHSM(): boolean {
    return this.hsmManager.isHardwareHSM();
  }

  /**
   * Generate PKCE authorization URL for user authentication
   */
  async generateAuthUrl(userId: string): Promise<AuthUrlResult> {
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    const state = this.generateState();
    
    // Store PKCE parameters for later verification with timestamp
    await this.storePKCEData(userId, { 
      codeVerifier, 
      state, 
      timestamp: Date.now() 
    });
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      state,
      scope: this.dynamicScopes,
      show_dialog: 'true'
    });
    
    const authUrl = `${AuthManager.SPOTIFY_AUTH_URL}?${params.toString()}`;
    
    this.logger.info('Generated authorization URL', {
      userId,
      authUrl: `${authUrl.substring(0, 100)}...` // Log truncated URL for security
    });
    
    return {
      authUrl,
      state,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    };
  }

  /**
   * Exchange authorization code for access tokens
   */
  async exchangeCodeForTokens(userId: string, code: string, state: string): Promise<AuthResult> {
    try {
      // Verify state parameter and expiration
      const pkceData = await this.retrievePKCEData(userId);
      if (!pkceData || pkceData.state !== state) {
        throw new AuthError('Invalid state parameter - possible CSRF attack', { retryable: false });
      }
      
      // Check state parameter expiration (10 minutes)
      const stateAge = Date.now() - pkceData.timestamp;
      const maxStateAge = 10 * 60 * 1000; // 10 minutes
      if (stateAge > maxStateAge) {
        await this.deletePKCEData(userId); // Clean up expired data
        throw new AuthError('State parameter has expired - please restart authentication flow', { retryable: false });
      }
      
      const tokenData = {
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code_verifier: pkceData.codeVerifier
      };
      
      const response = await axios.post(AuthManager.SPOTIFY_TOKEN_URL, tokenData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      });
      
      const tokens = TokenResponseSchema.parse(response.data);
      const authTokens: AuthTokens = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || '',
        expiresAt: new Date(Date.now() + (tokens.expires_in * 1000)),
        scope: tokens.scope || this.dynamicScopes,
        tokenType: tokens.token_type || 'Bearer'
      };
      
      // Store encrypted tokens
      await this.storeTokens(userId, authTokens);
      
      // Clean up PKCE data
      await this.deletePKCEData(userId);
      
      this.logger.info('Successfully exchanged authorization code for tokens', {
        userId,
        expiresAt: authTokens.expiresAt.toISOString(),
        scopes: authTokens.scope
      });
      
      return {
        success: true,
        tokens: authTokens
      };
      
    } catch (error) {
      this.logger.error('Failed to exchange authorization code', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const data = error.response?.data;
        
        const details: {
          retryable: boolean;
          statusCode?: number;
          spotifyError?: unknown;
        } = {
          retryable: status ? status >= 500 : false,
          spotifyError: data
        };
        
        if (status) {
          details.statusCode = status;
        }
        
        throw new AuthError(
          `Spotify authentication failed: ${data?.error_description || error.message}`,
          details
        );
      }
      
      throw new AuthError('Authentication failed', { retryable: false });
    }
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  async getValidToken(userId: string): Promise<string> {
    const tokens = await this.retrieveTokens(userId);
    
    if (!tokens) {
      throw new AuthError('No authentication tokens found - please authenticate first', {
        retryable: false,
        requiresAuth: true
      });
    }
    
    // Check if token needs refresh (with 5-minute buffer)
    const now = new Date();
    const refreshThreshold = new Date(tokens.expiresAt.getTime() - 5 * 60 * 1000);
    
    if (now >= refreshThreshold) {
      this.logger.info('Access token expired or expiring soon, refreshing', {
        userId,
        expiresAt: tokens.expiresAt.toISOString()
      });
      
      const refreshedTokens = await this.refreshAccessToken(userId, tokens);
      return refreshedTokens.accessToken;
    }
    
    return tokens.accessToken;
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(userId: string, currentTokens: AuthTokens): Promise<AuthTokens> {
    if (!currentTokens.refreshToken) {
      throw new AuthError('No refresh token available - please re-authenticate', {
        retryable: false,
        requiresAuth: true
      });
    }
    
    try {
      const tokenData = {
        grant_type: 'refresh_token',
        refresh_token: currentTokens.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret
      };
      
      const response = await axios.post(AuthManager.SPOTIFY_TOKEN_URL, tokenData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      });
      
      const tokens = TokenResponseSchema.parse(response.data);
      const newTokens: AuthTokens = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || currentTokens.refreshToken, // Keep existing if not provided
        expiresAt: new Date(Date.now() + (tokens.expires_in * 1000)),
        scope: tokens.scope || currentTokens.scope,
        tokenType: tokens.token_type || 'Bearer'
      };
      
      // Store updated tokens
      await this.storeTokens(userId, newTokens);
      
      this.logger.info('Successfully refreshed access token', {
        userId,
        expiresAt: newTokens.expiresAt.toISOString()
      });
      
      return newTokens;
      
    } catch (error) {
      this.logger.error('Failed to refresh access token', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const data = error.response?.data;
        
        // If refresh token is invalid, user needs to re-authenticate
        if (status === 400 && data?.error === 'invalid_grant') {
          await this.deleteTokens(userId);
          throw new AuthError('Refresh token expired - please re-authenticate', {
            retryable: false,
            requiresAuth: true
          });
        }
        
        const details: {
          retryable: boolean;
          statusCode?: number;
        } = {
          retryable: status ? status >= 500 : false
        };
        
        if (status) {
          details.statusCode = status;
        }
        
        throw new AuthError(
          `Token refresh failed: ${data?.error_description || error.message}`,
          details
        );
      }
      
      throw new AuthError('Token refresh failed', { retryable: false });
    }
  }

  /**
   * Revoke tokens and delete stored authentication data
   */
  async revokeTokens(userId: string): Promise<void> {
    try {
      const tokens = await this.retrieveTokens(userId);
      if (tokens?.accessToken) {
        // Attempt to revoke token with Spotify (best effort)
        try {
          await axios.post('https://accounts.spotify.com/api/token/revoke', 
            `token=${tokens.accessToken}`,
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
              },
              timeout: 5000
            }
          );
        } catch (revokeError) {
          this.logger.warn('Failed to revoke token with Spotify', {
            userId,
            error: revokeError instanceof Error ? revokeError.message : 'Unknown error'
          });
        }
      }
      
      // Always delete local tokens
      await this.deleteTokens(userId);
      
      this.logger.info('Successfully revoked tokens', { userId });
      
    } catch (error) {
      this.logger.error('Error during token revocation', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Check if user has valid authentication
   */
  async isAuthenticated(userId: string): Promise<boolean> {
    try {
      const tokens = await this.retrieveTokens(userId);
      return tokens !== null && tokens.accessToken.length > 0;
    } catch {
      return false;
    }
  }
  
  /**
   * Get scope manager for tool validation
   */
  getScopeManager(): ScopeManager {
    return this.scopeManager;
  }
  
  /**
   * Validate OAuth scopes for current configuration
   */
  validateCurrentScopes(requestedScopes: string[]): {
    valid: boolean;
    issues?: string[];
    recommendations?: string[];
  } {
    const validation = this.scopeManager.validateScopeConfiguration(requestedScopes);
    
    return {
      valid: validation.valid,
      issues: [...validation.missingScopes, ...validation.excessiveScopes],
      recommendations: validation.recommendations,
    };
  }
  
  /**
   * Get security recommendations for current scope configuration
   */
  getSecurityRecommendations(): string[] {
    return this.scopeManager.getSecurityRecommendations();
  }

  // Private helper methods

  private generateCodeVerifier(): string {
    return randomBytes(32).toString('base64url');
  }

  private generateCodeChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
  }

  private generateState(): string {
    return randomBytes(16).toString('base64url');
  }

  /**
   * Derive encryption key using PBKDF2 with salt for enhanced security
   * 
   * @param secret - Client secret to derive key from
   * @param salt - Random salt for key derivation
   * @returns Derived encryption key
   */
  private deriveEncryptionKey(secret: string, salt: Buffer): Buffer {
    // Use PBKDF2 with 100,000 iterations, 32-byte key length, and SHA-256
    // This provides strong key derivation that is resistant to rainbow table attacks
    return pbkdf2Sync(secret, salt, 100000, 32, 'sha256');
  }

  /**
   * Get or create a salt for key derivation
   * 
   * @returns Salt buffer
   */
  private getOrCreateSalt(): Buffer {
    const saltPath = join(this.tokenDir, '.salt');
    
    try {
      if (existsSync(saltPath)) {
        return readFileSync(saltPath);
      }
    } catch (error) {
      this.logger.warn('Failed to read existing salt, generating new one', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    // Generate new cryptographically secure salt
    const salt = randomBytes(32);
    
    try {
      this.ensureTokenDirectory();
      writeFileSync(saltPath, salt, { mode: 0o600 });
      this.logger.info('Generated new encryption salt');
    } catch (error) {
      this.logger.error('Failed to save salt file', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Failed to initialize encryption salt');
    }
    
    return salt;
  }

  private ensureTokenDirectory(): void {
    if (!existsSync(this.tokenDir)) {
      mkdirSync(this.tokenDir, { recursive: true, mode: 0o700 });
    }
  }

  private async encrypt(data: string): Promise<string> {
    // Try HSM encryption first if available
    if (this.hsmEncryptionKeyId) {
      try {
        const plaintext = Buffer.from(data, 'utf8');
        const encryptedBuffer = await this.hsmManager.encrypt(this.hsmEncryptionKeyId, plaintext);
        // Use 'hsm:' prefix to indicate HSM encryption
        return `hsm:${encryptedBuffer.toString('base64')}`;
      } catch (error) {
        this.logger.warn('HSM encryption failed, falling back to PBKDF2', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    // Fallback to PBKDF2-based encryption
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    // Use 'pbkdf2:' prefix to indicate PBKDF2 encryption
    return `pbkdf2:${iv.toString('hex')}:${encrypted}`;
  }

  private async decrypt(encryptedData: string): Promise<string> {
    // Check if data is HSM encrypted
    if (encryptedData.startsWith('hsm:')) {
      if (!this.hsmEncryptionKeyId) {
        throw new Error('HSM encrypted data found but HSM key not available');
      }
      
      try {
        const encryptedBase64 = encryptedData.substring(4); // Remove 'hsm:' prefix
        const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');
        const decryptedBuffer = await this.hsmManager.decrypt(this.hsmEncryptionKeyId, encryptedBuffer);
        return decryptedBuffer.toString('utf8');
      } catch (error) {
        this.logger.error('HSM decryption failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new Error('Failed to decrypt HSM-encrypted data');
      }
    }
    
    // Handle PBKDF2 encrypted data (new format with prefix)
    if (encryptedData.startsWith('pbkdf2:')) {
      const parts = encryptedData.substring(7).split(':'); // Remove 'pbkdf2:' prefix
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new Error('Invalid PBKDF2 encrypted data format');
      }
      
      const ivHex = parts[0];
      const encrypted = parts[1];
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }
    
    // Handle legacy format (no prefix - assume PBKDF2)
    const parts = encryptedData.split(':');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error('Invalid encrypted data format');
    }
    
    this.logger.debug('Decrypting legacy format data, consider re-encrypting');
    const ivHex = parts[0];
    const encrypted = parts[1];
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private async storeTokens(userId: string, tokens: AuthTokens): Promise<void> {
    const tokenFile = join(this.tokenDir, `${userId}.tokens`);
    const encryptedData = await this.encrypt(JSON.stringify(tokens));
    writeFileSync(tokenFile, encryptedData, { mode: 0o600 });
  }

  private async retrieveTokens(userId: string): Promise<AuthTokens | null> {
    const tokenFile = join(this.tokenDir, `${userId}.tokens`);
    
    if (!existsSync(tokenFile)) {
      return null;
    }
    
    try {
      const encryptedData = readFileSync(tokenFile, 'utf8');
      const decryptedData = await this.decrypt(encryptedData);
      const tokens = JSON.parse(decryptedData);
      
      // Parse dates
      return {
        ...tokens,
        expiresAt: new Date(tokens.expiresAt)
      };
    } catch (error) {
      this.logger.error('Failed to decrypt tokens', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  private async deleteTokens(userId: string): Promise<void> {
    const tokenFile = join(this.tokenDir, `${userId}.tokens`);
    if (existsSync(tokenFile)) {
      const fs = await import('fs/promises');
      await fs.unlink(tokenFile);
    }
  }

  private async storePKCEData(userId: string, data: PKCEData): Promise<void> {
    const pkceFile = join(this.tokenDir, `${userId}.pkce`);
    const encryptedData = await this.encrypt(JSON.stringify(data));
    writeFileSync(pkceFile, encryptedData, { mode: 0o600 });
  }

  private async retrievePKCEData(userId: string): Promise<PKCEData | null> {
    const pkceFile = join(this.tokenDir, `${userId}.pkce`);
    
    if (!existsSync(pkceFile)) {
      return null;
    }
    
    try {
      const encryptedData = readFileSync(pkceFile, 'utf8');
      const decryptedData = await this.decrypt(encryptedData);
      return JSON.parse(decryptedData);
    } catch (error) {
      this.logger.error('Failed to decrypt PKCE data', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  private async deletePKCEData(userId: string): Promise<void> {
    const pkceFile = join(this.tokenDir, `${userId}.pkce`);
    if (existsSync(pkceFile)) {
      const fs = await import('fs/promises');
      await fs.unlink(pkceFile);
    }
  }
}

// Validation schemas
const TokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
  expires_in: z.number(),
  refresh_token: z.string().optional()
});

// Types
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
  timestamp: number; // Unix timestamp when state was created
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly details: {
      retryable: boolean;
      requiresAuth?: boolean;
      statusCode?: number;
      spotifyError?: unknown;
    }
  ) {
    super(message);
    this.name = 'AuthError';
  }
}