/**
 * MCP Client Authentication System
 * 
 * Provides authentication and authorization for MCP clients to prevent
 * unauthorized access and tool execution by malicious scripts or processes.
 */

import { randomBytes, createHmac } from 'crypto';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { Logger } from '../types/index.js';

export interface ClientAuthConfig {
  enabled: boolean;
  requireAuth: boolean;
  tokenLifetime: number; // in milliseconds
  allowedOrigins: string[];
  rateLimitPerClient: number; // requests per minute
}

export interface ClientCredentials {
  clientId: string;
  clientSecret: string;
  name: string;
  scopes: string[];
  created: Date;
  lastUsed?: Date;
}

export interface AuthToken {
  token: string;
  clientId: string;
  issued: Date;
  expires: Date;
  scopes: string[];
}

export interface ClientRequest {
  token?: string;
  origin?: string;
  userAgent?: string;
  timestamp: number;
}

/**
 * Client authenticator for MCP server security
 */
export class ClientAuthenticator {
  private readonly logger: Logger;
  private readonly config: ClientAuthConfig;
  private readonly authDir: string;
  private readonly clients: Map<string, ClientCredentials> = new Map();
  private readonly tokens: Map<string, AuthToken> = new Map();
  private readonly requestCounts: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(config: Partial<ClientAuthConfig>, logger: Logger) {
    this.logger = logger;
    this.config = {
      enabled: config.enabled ?? true,
      requireAuth: config.requireAuth ?? process.env.NODE_ENV === 'production',
      tokenLifetime: config.tokenLifetime ?? 3600000, // 1 hour default
      allowedOrigins: config.allowedOrigins ?? ['localhost', '127.0.0.1'],
      rateLimitPerClient: config.rateLimitPerClient ?? 100, // 100 requests per minute
    };
    
    this.authDir = join(homedir(), '.spotify-mcp', 'auth');
    this.ensureAuthDirectory();
    this.loadClients();
    this.startCleanupTimer();

    this.logger.info('Client authenticator initialized', {
      enabled: this.config.enabled,
      requireAuth: this.config.requireAuth,
      tokenLifetime: this.config.tokenLifetime,
      allowedOrigins: this.config.allowedOrigins,
    });
  }

  /**
   * Get current configuration (for testing and monitoring)
   */
  getConfiguration(): ClientAuthConfig {
    return { ...this.config };
  }

  /**
   * Authenticate a client request
   */
  async authenticateRequest(request: ClientRequest): Promise<{ 
    authenticated: boolean; 
    clientId?: string; 
    scopes?: string[];
    error?: string;
  }> {
    // Skip authentication if disabled
    if (!this.config.enabled) {
      return { authenticated: true, clientId: 'anonymous' };
    }

    // Check rate limiting first
    const rateLimitResult = this.checkRateLimit(request);
    if (!rateLimitResult.allowed) {
      this.logger.warn('Rate limit exceeded for client', {
        origin: request.origin,
        userAgent: request.userAgent,
        requestCount: rateLimitResult.count,
      });
      return { 
        authenticated: false, 
        error: 'Rate limit exceeded. Please try again later.' 
      };
    }

    // Validate origin if provided
    if (request.origin && !this.isOriginAllowed(request.origin)) {
      this.logger.warn('Request from unauthorized origin', {
        origin: request.origin,
        allowedOrigins: this.config.allowedOrigins,
      });
      return { 
        authenticated: false, 
        error: 'Unauthorized origin' 
      };
    }

    // Check if authentication is required
    if (!this.config.requireAuth) {
      return { authenticated: true, clientId: 'anonymous' };
    }

    // Validate token if provided
    if (!request.token) {
      return { 
        authenticated: false, 
        error: 'Authentication token required' 
      };
    }

    const tokenValidation = this.validateToken(request.token);
    if (!tokenValidation.valid) {
      this.logger.warn('Invalid authentication token', {
        error: tokenValidation.error,
        origin: request.origin,
      });
      return { 
        authenticated: false, 
        error: tokenValidation.error || 'Invalid authentication token' 
      };
    }

    // Update last used timestamp
    const client = tokenValidation.clientId ? this.clients.get(tokenValidation.clientId) : undefined;
    if (client) {
      client.lastUsed = new Date();
      this.saveClients();
    }

    this.logger.debug('Client authenticated successfully', {
      clientId: tokenValidation.clientId,
      scopes: tokenValidation.scopes,
    });

    return {
      authenticated: true,
      clientId: tokenValidation.clientId || undefined,
      scopes: tokenValidation.scopes || undefined,
    };
  }

  /**
   * Create a new client with credentials
   */
  async createClient(name: string, scopes: string[] = []): Promise<{
    clientId: string;
    clientSecret: string;
  }> {
    const clientId = this.generateClientId();
    const clientSecret = this.generateClientSecret();

    const credentials: ClientCredentials = {
      clientId,
      clientSecret,
      name,
      scopes,
      created: new Date(),
    };

    this.clients.set(clientId, credentials);
    this.saveClients();

    this.logger.info('New client created', {
      clientId,
      name,
      scopes,
    });

    return { clientId, clientSecret };
  }

  /**
   * Generate authentication token for client
   */
  async generateToken(clientId: string, clientSecret: string): Promise<{
    token: string;
    expires: Date;
  }> {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error('Client not found');
    }

    if (client.clientSecret !== clientSecret) {
      throw new Error('Invalid client credentials');
    }

    const token = this.generateAuthToken();
    const expires = new Date(Date.now() + this.config.tokenLifetime);

    const authToken: AuthToken = {
      token,
      clientId,
      issued: new Date(),
      expires,
      scopes: client.scopes,
    };

    this.tokens.set(token, authToken);

    this.logger.info('Authentication token generated', {
      clientId,
      expires: expires.toISOString(),
    });

    return { token, expires };
  }

  /**
   * Revoke authentication token
   */
  async revokeToken(token: string): Promise<void> {
    const authToken = this.tokens.get(token);
    if (!authToken) {
      throw new Error('Token not found');
    }

    this.tokens.delete(token);

    this.logger.info('Authentication token revoked', {
      clientId: authToken.clientId,
    });
  }

  /**
   * List all registered clients
   */
  listClients(): Array<Omit<ClientCredentials, 'clientSecret'>> {
    return Array.from(this.clients.values()).map(client => ({
      clientId: client.clientId,
      name: client.name,
      scopes: client.scopes,
      created: client.created,
      lastUsed: client.lastUsed || undefined,
    }));
  }

  /**
   * Delete a client
   */
  async deleteClient(clientId: string): Promise<void> {
    if (!this.clients.has(clientId)) {
      throw new Error('Client not found');
    }

    // Revoke all tokens for this client
    for (const [token, authToken] of this.tokens.entries()) {
      if (authToken.clientId === clientId) {
        this.tokens.delete(token);
      }
    }

    this.clients.delete(clientId);
    this.saveClients();

    this.logger.info('Client deleted', { clientId });
  }

  /**
   * Check if client has required scope
   */
  hasScope(clientId: string, requiredScope: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    return client.scopes.includes(requiredScope) || client.scopes.includes('*');
  }

  // Private methods

  private validateToken(token: string): {
    valid: boolean;
    clientId?: string;
    scopes?: string[];
    error?: string;
  } {
    const authToken = this.tokens.get(token);
    if (!authToken) {
      return { valid: false, error: 'Token not found' };
    }

    if (authToken.expires < new Date()) {
      this.tokens.delete(token);
      return { valid: false, error: 'Token expired' };
    }

    return {
      valid: true,
      clientId: authToken.clientId,
      scopes: authToken.scopes,
    };
  }

  private checkRateLimit(request: ClientRequest): { allowed: boolean; count: number } {
    const identifier = request.origin || request.userAgent || 'unknown';
    const now = Date.now();
    const _windowStart = now - 60000; // 1 minute window

    let rateLimitData = this.requestCounts.get(identifier);
    
    if (!rateLimitData || rateLimitData.resetTime < now) {
      rateLimitData = { count: 0, resetTime: now + 60000 };
      this.requestCounts.set(identifier, rateLimitData);
    }

    rateLimitData.count++;

    return {
      allowed: rateLimitData.count <= this.config.rateLimitPerClient,
      count: rateLimitData.count,
    };
  }

  private isOriginAllowed(origin: string): boolean {
    return this.config.allowedOrigins.some(allowed => 
      origin.includes(allowed) || allowed === '*'
    );
  }

  private generateClientId(): string {
    return `mcp_${  randomBytes(16).toString('hex')}`;
  }

  private generateClientSecret(): string {
    return randomBytes(32).toString('base64url');
  }

  private generateAuthToken(): string {
    // Require secure token secret - no fallback allowed
    const secret = process.env.MCP_TOKEN_SECRET;
    if (!secret) {
      throw new Error('MCP_TOKEN_SECRET environment variable is required for secure token generation');
    }
    
    if (secret === 'default-secret-change-in-production') {
      throw new Error('Default MCP_TOKEN_SECRET detected - please use a secure random secret');
    }
    
    if (secret.length < 32) {
      throw new Error('MCP_TOKEN_SECRET must be at least 32 characters for security');
    }
    
    // Generate token with enhanced entropy
    const timestamp = Date.now().toString();
    const random = randomBytes(32).toString('hex'); // Increased from 24 to 32 bytes
    const nonce = randomBytes(8).toString('hex'); // Additional entropy
    const payload = `${timestamp}.${random}.${nonce}`;
    
    // Sign the token with HMAC-SHA256
    const signature = createHmac('sha256', secret).update(payload).digest('hex');
    
    return `${payload}.${signature}`;
  }

  private ensureAuthDirectory(): void {
    if (!existsSync(this.authDir)) {
      mkdirSync(this.authDir, { recursive: true, mode: 0o700 });
    }
  }

  private loadClients(): void {
    const clientsFile = join(this.authDir, 'clients.json');
    if (existsSync(clientsFile)) {
      try {
        const data = readFileSync(clientsFile, 'utf8');
        const clients = JSON.parse(data);
        
        for (const client of clients) {
          this.clients.set(client.clientId, {
            ...client,
            created: new Date(client.created),
            lastUsed: client.lastUsed ? new Date(client.lastUsed) : undefined,
          });
        }

        this.logger.debug('Loaded clients from file', {
          count: this.clients.size,
        });
      } catch (error) {
        this.logger.error('Failed to load clients file', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  private saveClients(): void {
    const clientsFile = join(this.authDir, 'clients.json');
    const clients = Array.from(this.clients.values());
    
    try {
      writeFileSync(clientsFile, JSON.stringify(clients, null, 2), { mode: 0o600 });
    } catch (error) {
      this.logger.error('Failed to save clients file', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private startCleanupTimer(): void {
    // Clean up expired tokens every 5 minutes
    setInterval(() => {
      const now = new Date();
      let removedCount = 0;

      for (const [token, authToken] of this.tokens.entries()) {
        if (authToken.expires < now) {
          this.tokens.delete(token);
          removedCount++;
        }
      }

      if (removedCount > 0) {
        this.logger.debug('Cleaned up expired tokens', { count: removedCount });
      }

      // Clean up old rate limit entries
      const windowStart = Date.now() - 60000;
      for (const [identifier, data] of this.requestCounts.entries()) {
        if (data.resetTime < windowStart) {
          this.requestCounts.delete(identifier);
        }
      }
    }, 300000); // 5 minutes
  }
}

/**
 * Factory function to create client authenticator
 */
export function createClientAuthenticator(
  config: Partial<ClientAuthConfig>,
  logger: Logger
): ClientAuthenticator {
  return new ClientAuthenticator(config, logger);
}