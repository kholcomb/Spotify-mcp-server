/**
 * OAuth Scope Management and Restriction System
 * 
 * Provides granular control over Spotify OAuth scopes with tool-based
 * restrictions to minimize permission exposure and enhance security.
 */

import type { Logger } from '../types/index.js';

export interface ScopeConfig {
  tier: 'read-only' | 'limited' | 'full-access';
  requiredScopes: string[];
  optionalScopes: string[];
  restrictedScopes: string[];
  toolRestrictions: Record<string, string[]>;
}

export interface ScopeValidation {
  valid: boolean;
  missingScopes: string[];
  excessiveScopes: string[];
  recommendations: string[];
}

/**
 * Available Spotify OAuth scopes organized by functionality
 */
export const SPOTIFY_SCOPES = {
  // Read-only user data
  readOnly: [
    'user-read-email',
    'user-read-private',
    'user-read-playback-state',
    'user-read-currently-playing',
    'user-read-recently-played',
    'user-library-read',
    'user-top-read',
    'user-follow-read',
    'playlist-read-private',
    'playlist-read-collaborative',
  ],
  
  // Playback control (requires Premium)
  playback: [
    'user-modify-playback-state',
    'streaming', // Remove this for minimal permissions
  ],
  
  // Write operations (potentially destructive)
  write: [
    'user-library-modify',
    'user-follow-modify',
    'playlist-modify-public',
    'playlist-modify-private',
    'ugc-image-upload',
  ],
  
  // Deprecated or unnecessary for MCP server
  deprecated: [
    'streaming', // Not needed for MCP tool operations
    'app-remote-control', // Not applicable
    'user-read-birthdate', // Not needed
  ],
} as const;

/**
 * Scope tiers with predefined permission sets
 */
export const SCOPE_TIERS: Record<string, ScopeConfig> = {
  'read-only': {
    tier: 'read-only',
    requiredScopes: [
      'user-read-private',
      'user-read-playback-state',
      'user-read-currently-playing',
      'user-library-read',
    ],
    optionalScopes: [
      'user-read-email',
      'user-read-recently-played',
      'user-top-read',
      'user-follow-read',
      'playlist-read-private',
      'playlist-read-collaborative',
    ],
    restrictedScopes: [
      ...SPOTIFY_SCOPES.playback,
      ...SPOTIFY_SCOPES.write,
    ],
    toolRestrictions: {
      // Only allow read-only tools
      'authenticate': [],
      'get_auth_status': [],
      'health_check': [],
      'search': [],
      'get_user_profile': [],
      'get_playback_status': [],
      'get_devices': [],
      'get_user_top_tracks': [],
      'get_user_top_artists': [],
      'get_audio_features': [],
      'get_user_saved_tracks': [],
      'get_user_saved_albums': [],
      'get_user_followed_artists': [],
    },
  },
  
  'limited': {
    tier: 'limited',
    requiredScopes: [
      'user-read-private',
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-read-currently-playing',
      'user-library-read',
    ],
    optionalScopes: [
      'user-read-email',
      'user-read-recently-played',
      'user-top-read',
      'user-follow-read',
      'playlist-read-private',
      'playlist-read-collaborative',
    ],
    restrictedScopes: [
      'streaming', // Remove streaming scope
      ...SPOTIFY_SCOPES.write, // No write operations
    ],
    toolRestrictions: {
      // Allow read and basic playback control
      'play': ['user-modify-playback-state'],
      'pause': ['user-modify-playback-state'],
      'skip_next': ['user-modify-playback-state'],
      'skip_previous': ['user-modify-playback-state'],
      'set_volume': ['user-modify-playback-state'],
      'set_shuffle': ['user-modify-playback-state'],
      'set_repeat': ['user-modify-playback-state'],
      'seek': ['user-modify-playback-state'],
      'transfer_playback': ['user-modify-playback-state'],
      'add_to_queue': ['user-modify-playback-state'],
      'get_queue': ['user-read-playback-state'],
      'clear_queue': ['user-modify-playback-state'],
      'add_playlist_to_queue': ['user-modify-playback-state'],
    },
  },
  
  'full-access': {
    tier: 'full-access',
    requiredScopes: [
      'user-read-private',
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-read-currently-playing',
      'user-library-read',
    ],
    optionalScopes: [
      'user-read-email',
      'user-read-recently-played',
      'user-top-read',
      'user-follow-read',
      'playlist-read-private',
      'playlist-read-collaborative',
      'user-library-modify',
      'user-follow-modify',
    ],
    restrictedScopes: [
      'streaming', // Still exclude streaming
      'ugc-image-upload',
      'playlist-modify-public', // Be cautious with public playlist modifications
    ],
    toolRestrictions: {}, // No tool restrictions for full access
  },
} as const;

/**
 * Tool scope requirements mapping
 */
export const TOOL_SCOPE_REQUIREMENTS: Record<string, string[]> = {
  // Authentication tools
  'authenticate': [],
  'get_auth_status': [],
  'health_check': [],
  
  // Search and discovery
  'search': [],
  'get_recommendations': [],
  
  // User profile and data
  'get_user_profile': ['user-read-private'],
  'get_user_top_tracks': ['user-top-read'],
  'get_user_top_artists': ['user-top-read'],
  'get_user_saved_tracks': ['user-library-read'],
  'get_user_saved_albums': ['user-library-read'],
  'get_user_followed_artists': ['user-follow-read'],
  
  // Playback status
  'get_playback_status': ['user-read-playback-state'],
  'get_devices': ['user-read-playback-state'],
  'get_queue': ['user-read-playback-state'],
  
  // Playback control (requires Premium)
  'play': ['user-modify-playback-state'],
  'pause': ['user-modify-playback-state'],
  'skip_next': ['user-modify-playback-state'],
  'skip_previous': ['user-modify-playback-state'],
  'set_volume': ['user-modify-playback-state'],
  'set_shuffle': ['user-modify-playback-state'],
  'set_repeat': ['user-modify-playback-state'],
  'seek': ['user-modify-playback-state'],
  'transfer_playbook': ['user-modify-playback-state'],
  
  // Queue management
  'add_to_queue': ['user-modify-playback-state'],
  'clear_queue': ['user-modify-playback-state'],
  'add_playlist_to_queue': ['user-modify-playback-state'],
  
  // Audio features
  'get_audio_features': [],
} as const;

/**
 * Scope manager for OAuth permission control
 */
export class ScopeManager {
  private readonly logger: Logger;
  private readonly currentTier: string;
  private readonly config: ScopeConfig;

  constructor(tier: keyof typeof SCOPE_TIERS, logger: Logger) {
    this.logger = logger;
    this.currentTier = tier;
    this.config = SCOPE_TIERS[tier];

    this.logger.info('Scope manager initialized', {
      tier,
      requiredScopes: this.config.requiredScopes.length,
      optionalScopes: this.config.optionalScopes.length,
      restrictedScopes: this.config.restrictedScopes.length,
    });
  }

  /**
   * Get required scopes for current tier
   */
  getRequiredScopes(): string[] {
    return [...this.config.requiredScopes];
  }

  /**
   * Get all allowed scopes for current tier
   */
  getAllowedScopes(): string[] {
    return [...this.config.requiredScopes, ...this.config.optionalScopes];
  }

  /**
   * Get scopes formatted for OAuth request
   */
  getScopeString(): string {
    return this.getAllowedScopes().join(' ');
  }

  /**
   * Validate if tool can be executed with current scopes
   */
  validateToolAccess(toolName: string, userScopes: string[]): {
    allowed: boolean;
    missingScopes: string[];
    reason?: string;
  } {
    // Check if tool is restricted in current tier
    const toolRestrictions = this.config.toolRestrictions[toolName];
    if (toolRestrictions !== undefined && this.currentTier !== 'full-access') {
      if (toolRestrictions.length === 0) {
        // Tool is allowed without additional scopes
      } else {
        // Check if user has required scopes for this tool
        const missingScopes = toolRestrictions.filter(scope => !userScopes.includes(scope));
        if (missingScopes.length > 0) {
          return {
            allowed: false,
            missingScopes,
            reason: `Tool requires scopes: ${missingScopes.join(', ')}`,
          };
        }
      }
    } else if (toolRestrictions === undefined && this.currentTier !== 'full-access') {
      return {
        allowed: false,
        missingScopes: [],
        reason: `Tool '${toolName}' not allowed in '${this.currentTier}' tier`,
      };
    }

    // Check tool-specific scope requirements
    const requiredScopes = TOOL_SCOPE_REQUIREMENTS[toolName] || [];
    const missingScopes = requiredScopes.filter(scope => !userScopes.includes(scope));

    if (missingScopes.length > 0) {
      return {
        allowed: false,
        missingScopes,
        reason: `Missing required scopes: ${missingScopes.join(', ')}`,
      };
    }

    return { allowed: true, missingScopes: [] };
  }

  /**
   * Validate OAuth scope configuration
   */
  validateScopeConfiguration(requestedScopes: string[]): ScopeValidation {
    const allowedScopes = this.getAllowedScopes();
    const restrictedScopes = this.config.restrictedScopes;

    // Check for missing required scopes
    const missingScopes = this.config.requiredScopes.filter(
      scope => !requestedScopes.includes(scope)
    );

    // Check for excessive/restricted scopes
    const excessiveScopes = requestedScopes.filter(
      scope => restrictedScopes.includes(scope)
    );

    // Check for scopes not in allowed list
    const unknownScopes = requestedScopes.filter(
      scope => !allowedScopes.includes(scope) && !restrictedScopes.includes(scope)
    );

    const recommendations: string[] = [];

    if (missingScopes.length > 0) {
      recommendations.push(`Add required scopes: ${missingScopes.join(', ')}`);
    }

    if (excessiveScopes.length > 0) {
      recommendations.push(`Remove restricted scopes: ${excessiveScopes.join(', ')}`);
    }

    if (unknownScopes.length > 0) {
      recommendations.push(`Unknown scopes detected: ${unknownScopes.join(', ')}`);
    }

    if (requestedScopes.includes('streaming')) {
      recommendations.push('Consider removing "streaming" scope - not required for MCP operations');
    }

    return {
      valid: missingScopes.length === 0 && excessiveScopes.length === 0 && unknownScopes.length === 0,
      missingScopes,
      excessiveScopes: [...excessiveScopes, ...unknownScopes],
      recommendations,
    };
  }

  /**
   * Get scope tier recommendations based on tool usage
   */
  recommendTier(usedTools: string[]): {
    recommendedTier: keyof typeof SCOPE_TIERS;
    reasoning: string;
    requiredScopes: string[];
  } {
    const writeTools = usedTools.filter(tool => 
      TOOL_SCOPE_REQUIREMENTS[tool]?.some(scope => 
        SPOTIFY_SCOPES.write.includes(scope as keyof typeof SPOTIFY_SCOPES.write)
      )
    );

    const playbackTools = usedTools.filter(tool => 
      TOOL_SCOPE_REQUIREMENTS[tool]?.includes('user-modify-playback-state')
    );

    const readOnlyTools = usedTools.filter(tool => {
      const scopes = TOOL_SCOPE_REQUIREMENTS[tool] || [];
      return scopes.length === 0 || scopes.every(scope => 
        SPOTIFY_SCOPES.readOnly.includes(scope as keyof typeof SPOTIFY_SCOPES.readOnly)
      );
    });

    if (writeTools.length > 0) {
      return {
        recommendedTier: 'full-access',
        reasoning: `Tools require write permissions: ${writeTools.join(', ')}`,
        requiredScopes: SCOPE_TIERS['full-access'].requiredScopes,
      };
    } else if (playbackTools.length > 0) {
      return {
        recommendedTier: 'limited',
        reasoning: `Tools require playback control: ${playbackTools.join(', ')}`,
        requiredScopes: SCOPE_TIERS['limited'].requiredScopes,
      };
    } else {
      return {
        recommendedTier: 'read-only',
        reasoning: `Only read-only operations detected: ${readOnlyTools.join(', ')}`,
        requiredScopes: SCOPE_TIERS['read-only'].requiredScopes,
      };
    }
  }

  /**
   * Check if scope requires Premium subscription
   */
  requiresPremium(scopes: string[]): boolean {
    const premiumRequiredScopes = ['user-modify-playback-state', 'streaming'];
    return scopes.some(scope => premiumRequiredScopes.includes(scope));
  }

  /**
   * Get security recommendations for current configuration
   */
  getSecurityRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.config.tier === 'full-access') {
      recommendations.push('Consider using "limited" tier if write operations are not needed');
    }

    if (this.config.requiredScopes.includes('streaming')) {
      recommendations.push('Remove "streaming" scope - not required for MCP tool operations');
    }

    if (this.config.optionalScopes.includes('user-read-email')) {
      recommendations.push('Consider removing email access if not needed for your use case');
    }

    return recommendations;
  }

  /**
   * Log scope usage for auditing
   */
  logScopeUsage(toolName: string, userScopes: string[]): void {
    const requiredScopes = TOOL_SCOPE_REQUIREMENTS[toolName] || [];
    
    this.logger.info('Tool scope usage', {
      tool: toolName,
      tier: this.currentTier,
      requiredScopes,
      userScopes: userScopes.length,
      hasAllRequired: requiredScopes.every(scope => userScopes.includes(scope)),
    });
  }

  /**
   * Get current tier configuration
   */
  getCurrentConfig(): ScopeConfig {
    return { ...this.config };
  }
}

/**
 * Factory function to create scope manager
 */
export function createScopeManager(
  tier: keyof typeof SCOPE_TIERS,
  logger: Logger
): ScopeManager {
  return new ScopeManager(tier, logger);
}

/**
 * Utility function to get minimal scopes for a set of tools
 */
export function getMinimalScopes(tools: string[]): string[] {
  const requiredScopes = new Set<string>();

  for (const tool of tools) {
    const toolScopes = TOOL_SCOPE_REQUIREMENTS[tool] || [];
    for (const scope of toolScopes) {
      requiredScopes.add(scope);
    }
  }

  return Array.from(requiredScopes);
}