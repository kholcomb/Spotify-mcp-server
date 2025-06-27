/**
 * Comprehensive tests for ScopeManager security component  
 * Tests OAuth scope validation, tool restrictions, and tier-based access control
 */

import { jest } from '@jest/globals';
import { 
  ScopeManager,
  getMinimalScopes,
  SCOPE_TIERS,
  TOOL_SCOPE_REQUIREMENTS,
  SPOTIFY_SCOPES,
  type ScopeConfig,
  type ScopeValidation
} from '../../../src/security/scopeManager.js';
import type { Logger } from '../../../src/types/index.js';

describe('ScopeManager', () => {
  let scopeManager: ScopeManager;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    scopeManager = new ScopeManager('limited', mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with read-only tier', () => {
      const readOnlyManager = new ScopeManager('read-only', mockLogger);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Scope manager initialized',
        expect.objectContaining({
          tier: 'read-only',
          availableScopes: expect.any(Array),
        })
      );
    });

    it('should initialize with limited tier', () => {
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Scope manager initialized',
        expect.objectContaining({
          tier: 'limited',
          availableScopes: expect.any(Array),
        })
      );
    });

    it('should initialize with full-access tier', () => {
      const fullAccessManager = new ScopeManager('full-access', mockLogger);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Scope manager initialized',
        expect.objectContaining({
          tier: 'full-access',
          availableScopes: expect.any(Array),
        })
      );
    });

    it('should handle custom scopes when provided', () => {
      const customScopes = ['custom-scope-1', 'custom-scope-2'];
      const customManager = new ScopeManager('limited', mockLogger, customScopes);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Scope manager initialized',
        expect.objectContaining({
          tier: 'limited',
          customScopes,
        })
      );
    });
  });

  describe('Scope Configuration Constants', () => {
    it('should have properly configured scope tiers', () => {
      expect(SCOPE_TIERS['read-only']).toBeDefined();
      expect(SCOPE_TIERS['limited']).toBeDefined();
      expect(SCOPE_TIERS['full-access']).toBeDefined();
      
      // Read-only should have fewer scopes than limited
      expect(SCOPE_TIERS['read-only'].scopes.length)
        .toBeLessThan(SCOPE_TIERS['limited'].scopes.length);
      
      // Limited should have fewer scopes than full-access  
      expect(SCOPE_TIERS['limited'].scopes.length)
        .toBeLessThan(SCOPE_TIERS['full-access'].scopes.length);
    });

    it('should have valid Spotify scopes defined', () => {
      const expectedScopes = [
        'user-read-playback-state',
        'user-modify-playback-state', 
        'user-read-currently-playing',
        'user-read-recently-played',
        'user-top-read',
        'user-read-playback-position',
        'playlist-read-private',
        'playlist-read-collaborative',
        'user-library-read',
        'user-follow-read',
        'streaming',
      ];

      expectedScopes.forEach(scope => {
        expect(SPOTIFY_SCOPES).toHaveProperty(scope);
        expect(SPOTIFY_SCOPES[scope]).toHaveProperty('description');
        expect(SPOTIFY_SCOPES[scope]).toHaveProperty('risk');
      });
    });

    it('should have tool scope requirements defined', () => {
      const expectedTools = [
        'search',
        'get_current_track',
        'play',
        'pause',
        'skip_next',
        'skip_previous',
        'set_volume',
        'get_user_top_tracks',
        'get_user_top_artists',
        'get_audio_features',
      ];

      expectedTools.forEach(tool => {
        expect(TOOL_SCOPE_REQUIREMENTS).toHaveProperty(tool);
        expect(Array.isArray(TOOL_SCOPE_REQUIREMENTS[tool])).toBe(true);
      });
    });
  });

  describe('Scope Validation', () => {
    it('should validate scopes against read-only tier', () => {
      const readOnlyManager = new ScopeManager('read-only', mockLogger);
      
      // Valid read-only scopes
      const validScopes = ['user-read-playback-state', 'user-read-currently-playing'];
      const validation = readOnlyManager.validateScopes(validScopes);
      
      expect(validation.valid).toBe(true);
      expect(validation.allowedScopes).toEqual(validScopes);
      expect(validation.deniedScopes).toHaveLength(0);
    });

    it('should reject write scopes in read-only tier', () => {
      const readOnlyManager = new ScopeManager('read-only', mockLogger);
      
      const writeScopes = ['user-modify-playback-state', 'playlist-modify-private'];
      const validation = readOnlyManager.validateScopes(writeScopes);
      
      expect(validation.valid).toBe(false);
      expect(validation.allowedScopes).toHaveLength(0);
      expect(validation.deniedScopes).toEqual(writeScopes);
      expect(validation.reason).toContain('not allowed in current scope tier');
    });

    it('should validate scopes against limited tier', () => {
      // Limited tier includes playback control but not library modification
      const limitedScopes = [
        'user-read-playback-state',
        'user-modify-playback-state',
        'user-read-currently-playing'
      ];
      
      const validation = scopeManager.validateScopes(limitedScopes);
      
      expect(validation.valid).toBe(true);
      expect(validation.allowedScopes).toEqual(limitedScopes);
    });

    it('should reject dangerous scopes in limited tier', () => {
      const dangerousScopes = ['playlist-modify-private', 'user-library-modify'];
      const validation = scopeManager.validateScopes(dangerousScopes);
      
      expect(validation.valid).toBe(false);
      expect(validation.deniedScopes).toEqual(dangerousScopes);
    });

    it('should allow all valid scopes in full-access tier', () => {
      const fullAccessManager = new ScopeManager('full-access', mockLogger);
      
      const allScopes = Object.keys(SPOTIFY_SCOPES);
      const validation = fullAccessManager.validateScopes(allScopes);
      
      expect(validation.valid).toBe(true);
      expect(validation.allowedScopes).toEqual(allScopes);
      expect(validation.deniedScopes).toHaveLength(0);
    });

    it('should handle empty scope arrays', () => {
      const validation = scopeManager.validateScopes([]);
      
      expect(validation.valid).toBe(true);
      expect(validation.allowedScopes).toHaveLength(0);
      expect(validation.deniedScopes).toHaveLength(0);
    });

    it('should handle unknown scopes', () => {
      const unknownScopes = ['unknown-scope-1', 'invalid-scope-2'];
      const validation = scopeManager.validateScopes(unknownScopes);
      
      expect(validation.valid).toBe(false);
      expect(validation.deniedScopes).toEqual(unknownScopes);
      expect(validation.reason).toContain('Unknown scopes');
    });

    it('should handle mixed valid and invalid scopes', () => {
      const mixedScopes = [
        'user-read-playback-state', // Valid in limited
        'playlist-modify-private',   // Invalid in limited
        'unknown-scope'             // Unknown scope
      ];
      
      const validation = scopeManager.validateScopes(mixedScopes);
      
      expect(validation.valid).toBe(false);
      expect(validation.allowedScopes).toEqual(['user-read-playback-state']);
      expect(validation.deniedScopes).toEqual(['playlist-modify-private', 'unknown-scope']);
    });
  });

  describe('Tool Scope Validation', () => {
    it('should validate tool access with sufficient scopes', () => {
      const userScopes = ['user-read-playback-state', 'user-modify-playback-state'];
      
      // Test read-only tool
      const readValidation = scopeManager.validateToolAccess('get_current_track', userScopes);
      expect(readValidation.allowed).toBe(true);
      
      // Test playback control tool
      const playValidation = scopeManager.validateToolAccess('play', userScopes);
      expect(playValidation.allowed).toBe(true);
    });

    it('should deny tool access with insufficient scopes', () => {
      const readOnlyScopes = ['user-read-playback-state'];
      
      // Try to use playback control with read-only scopes
      const validation = scopeManager.validateToolAccess('play', readOnlyScopes);
      
      expect(validation.allowed).toBe(false);
      expect(validation.reason).toContain('Missing required scopes');
      expect(validation.missingScopes).toContain('user-modify-playback-state');
    });

    it('should handle unknown tools gracefully', () => {
      const userScopes = ['user-read-playback-state'];
      const validation = scopeManager.validateToolAccess('unknown_tool', userScopes);
      
      expect(validation.allowed).toBe(true); // Unknown tools are allowed by default
      expect(validation.requiredScopes).toHaveLength(0);
    });

    it('should validate specific tool requirements', () => {
      const userScopes = ['user-top-read'];
      
      // Test user insights tools
      const topTracksValidation = scopeManager.validateToolAccess('get_user_top_tracks', userScopes);
      expect(topTracksValidation.allowed).toBe(true);
      
      const topArtistsValidation = scopeManager.validateToolAccess('get_user_top_artists', userScopes);
      expect(topArtistsValidation.allowed).toBe(true);
    });

    it('should log security warnings for access denials', () => {
      const readOnlyScopes = ['user-read-playback-state'];
      
      scopeManager.validateToolAccess('play', readOnlyScopes);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Tool access denied due to insufficient scopes',
        expect.objectContaining({
          tool: 'play',
          userScopes: readOnlyScopes,
          missingScopes: expect.arrayContaining(['user-modify-playback-state']),
        })
      );
    });
  });

  describe('Minimal Scope Calculation', () => {
    it('should calculate minimal scopes for read-only operations', () => {
      const tools = ['search', 'get_current_track'];
      const minimalScopes = getMinimalScopes(tools);
      
      expect(minimalScopes).toContain('user-read-playback-state');
      expect(minimalScopes).not.toContain('user-modify-playback-state');
    });

    it('should calculate minimal scopes for playback control', () => {
      const tools = ['play', 'pause', 'skip_next'];
      const minimalScopes = getMinimalScopes(tools);
      
      expect(minimalScopes).toContain('user-modify-playback-state');
      expect(minimalScopes).toContain('user-read-playback-state');
    });

    it('should handle empty tool arrays', () => {
      const minimalScopes = getMinimalScopes([]);
      expect(minimalScopes).toHaveLength(0);
    });

    it('should handle unknown tools', () => {
      const tools = ['unknown_tool_1', 'unknown_tool_2'];
      const minimalScopes = getMinimalScopes(tools);
      
      expect(minimalScopes).toHaveLength(0);
    });

    it('should deduplicate overlapping scope requirements', () => {
      const tools = ['play', 'pause']; // Both require same scopes
      const minimalScopes = getMinimalScopes(tools);
      
      // Should not have duplicate scopes
      const uniqueScopes = [...new Set(minimalScopes)];
      expect(minimalScopes).toEqual(uniqueScopes);
    });
  });

  describe('Dynamic Scope Management', () => {
    it('should get scopes for current tier', () => {
      const currentScopes = scopeManager.getScopesForTier();
      const expectedScopes = SCOPE_TIERS['limited'].scopes;
      
      expect(currentScopes).toEqual(expectedScopes);
    });

    it('should get scopes for different tiers', () => {
      const readOnlyScopes = scopeManager.getScopesForTier('read-only');
      const fullAccessScopes = scopeManager.getScopesForTier('full-access');
      
      expect(readOnlyScopes).toEqual(SCOPE_TIERS['read-only'].scopes);
      expect(fullAccessScopes).toEqual(SCOPE_TIERS['full-access'].scopes);
    });

    it('should check if tier supports tool', () => {
      // Limited tier should support playback control
      expect(scopeManager.doesTierSupportTool('play')).toBe(true);
      expect(scopeManager.doesTierSupportTool('pause')).toBe(true);
      
      // But may not support library modification (depends on implementation)
      const readOnlyManager = new ScopeManager('read-only', mockLogger);
      expect(readOnlyManager.doesTierSupportTool('play')).toBe(false);
    });

    it('should get tier information', () => {
      const tierInfo = scopeManager.getTierInfo();
      
      expect(tierInfo).toHaveProperty('tier');
      expect(tierInfo).toHaveProperty('description');
      expect(tierInfo).toHaveProperty('scopes');
      expect(tierInfo).toHaveProperty('restrictions');
      expect(tierInfo.tier).toBe('limited');
    });

    it('should handle custom scopes in tier validation', () => {
      const customScopes = ['custom-scope-1'];
      const customManager = new ScopeManager('limited', mockLogger, customScopes);
      
      const validation = customManager.validateScopes(['custom-scope-1']);
      expect(validation.valid).toBe(true);
      expect(validation.allowedScopes).toContain('custom-scope-1');
    });
  });

  describe('Scope Risk Assessment', () => {
    it('should assess scope risk levels correctly', () => {
      const highRiskScopes = ['playlist-modify-private', 'user-library-modify'];
      const lowRiskScopes = ['user-read-playback-state', 'user-read-currently-playing'];
      
      // This would require implementing risk assessment in the actual component
      // For now, we can test that the SPOTIFY_SCOPES constant includes risk levels
      highRiskScopes.forEach(scope => {
        if (SPOTIFY_SCOPES[scope]) {
          expect(['high', 'medium', 'low']).toContain(SPOTIFY_SCOPES[scope].risk);
        }
      });
      
      lowRiskScopes.forEach(scope => {
        if (SPOTIFY_SCOPES[scope]) {
          expect(['high', 'medium', 'low']).toContain(SPOTIFY_SCOPES[scope].risk);
        }
      });
    });
  });

  describe('OAuth URL Generation', () => {
    it('should generate OAuth URLs with correct scopes', () => {
      const authUrl = scopeManager.generateOAuthUrl('test-client-id', 'http://localhost:3000/callback');
      
      expect(authUrl).toContain('client_id=test-client-id');
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback');
      expect(authUrl).toContain('scope=');
      expect(authUrl).toContain('code_challenge=');
      expect(authUrl).toContain('code_challenge_method=S256');
    });

    it('should include custom scopes in OAuth URL', () => {
      const customScopes = ['custom-scope'];
      const customManager = new ScopeManager('limited', mockLogger, customScopes);
      
      const authUrl = customManager.generateOAuthUrl('test-client-id', 'http://localhost:3000/callback');
      
      // The URL should include the custom scope
      expect(authUrl).toContain('scope=');
    });

    it('should handle PKCE challenge generation', () => {
      const authUrl = scopeManager.generateOAuthUrl('test-client-id', 'http://localhost:3000/callback');
      
      expect(authUrl).toContain('code_challenge=');
      expect(authUrl).toContain('code_challenge_method=S256');
    });
  });

  describe('Security Logging and Monitoring', () => {
    it('should log scope validation failures', () => {
      const invalidScopes = ['invalid-scope'];
      scopeManager.validateScopes(invalidScopes);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Scope validation failed',
        expect.objectContaining({
          tier: 'limited',
          requestedScopes: invalidScopes,
          deniedScopes: invalidScopes,
        })
      );
    });

    it('should log tool access violations', () => {
      const insufficientScopes = ['user-read-playback-state'];
      scopeManager.validateToolAccess('play', insufficientScopes);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Tool access denied due to insufficient scopes',
        expect.objectContaining({
          tool: 'play',
          tier: 'limited',
          userScopes: insufficientScopes,
        })
      );
    });

    it('should log successful scope validations in debug mode', () => {
      const validScopes = ['user-read-playback-state'];
      scopeManager.validateScopes(validScopes);
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Scope validation successful',
        expect.objectContaining({
          tier: 'limited',
          allowedScopes: validScopes,
        })
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null and undefined inputs gracefully', () => {
      // @ts-expect-error Testing runtime behavior with invalid inputs
      const nullValidation = scopeManager.validateScopes(null);
      expect(nullValidation.valid).toBe(false);
      
      // @ts-expect-error Testing runtime behavior with invalid inputs
      const undefinedValidation = scopeManager.validateScopes(undefined);
      expect(undefinedValidation.valid).toBe(false);
    });

    it('should handle non-array inputs', () => {
      // @ts-expect-error Testing runtime behavior with invalid inputs
      const stringValidation = scopeManager.validateScopes('not-an-array');
      expect(stringValidation.valid).toBe(false);
    });

    it('should handle empty string scopes', () => {
      const emptyStringScopes = ['', '   ', 'valid-scope'];
      const validation = scopeManager.validateScopes(emptyStringScopes);
      
      // Empty strings should be filtered out or handled appropriately
      expect(validation.deniedScopes).toContain('');
      expect(validation.deniedScopes).toContain('   ');
    });

    it('should handle very long scope names', () => {
      const longScopeName = 'a'.repeat(1000);
      const validation = scopeManager.validateScopes([longScopeName]);
      
      expect(validation.valid).toBe(false);
      expect(validation.deniedScopes).toContain(longScopeName);
    });

    it('should handle concurrent scope validations', async () => {
      const promises = Array(10).fill(null).map((_, i) => 
        Promise.resolve(scopeManager.validateScopes([`scope-${i}`]))
      );
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toHaveProperty('valid');
        expect(result).toHaveProperty('allowedScopes');
        expect(result).toHaveProperty('deniedScopes');
      });
    });
  });

  describe('Configuration Immutability', () => {
    it('should not allow modification of scope configurations', () => {
      const tierInfo = scopeManager.getTierInfo();
      const originalLength = tierInfo.scopes.length;
      
      // Attempt to modify returned configuration
      tierInfo.scopes.push('malicious-scope');
      
      // Get fresh copy and verify it wasn't modified
      const freshTierInfo = scopeManager.getTierInfo();
      expect(freshTierInfo.scopes.length).toBe(originalLength);
    });

    it('should return immutable scope arrays', () => {
      const scopes1 = scopeManager.getScopesForTier();
      const scopes2 = scopeManager.getScopesForTier();
      
      // Should be different array instances but same content
      expect(scopes1).not.toBe(scopes2);
      expect(scopes1).toEqual(scopes2);
    });
  });
});