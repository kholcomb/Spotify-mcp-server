/**
 * Spotify status and authentication tools for MCP
 * 
 * Provides status checking, authentication management, and user information
 * through the MCP protocol.
 */

import { MCPTool, ToolResult } from '../types/index.js';
import { SpotifyClient as ISpotifyClient } from '../spotify/index.js';
import { AuthService as IAuthService } from '../auth/index.js';
import { SpotifyError, SpotifyAuthError } from '../spotify/errors.js';
import { z } from 'zod';

/**
 * Tool for getting current playback status
 */
export class GetPlaybackStatusTool implements MCPTool {
  public readonly name = 'get_playback_status';
  public readonly description = 'Get current Spotify playback status';
  
  public readonly inputSchema = z.object({
    market: z.string().length(2).optional().describe('ISO 3166-1 alpha-2 country code'),
    additionalTypes: z.array(z.enum(['track', 'episode'])).optional().describe('Additional types to include'),
  }).describe('Playback status options');

  constructor(private spotifyClient: ISpotifyClient) {}

  async execute(input: unknown): Promise<ToolResult> {
    try {
      const params = this.inputSchema.parse(input);
      
      const options: Record<string, unknown> = {};
      if (params.market) options.market = params.market;
      if (params.additionalTypes) options.additional_types = params.additionalTypes.join(',');

      const playback = await this.spotifyClient.getCurrentPlayback(options);
      
      if (!playback) {
        return {
          success: true,
          data: {
            is_playing: false,
            message: 'No active playback session found',
          },
        };
      }

      // Format playback information
      const currentItem = playback.item ? {
        id: playback.item.id,
        name: playback.item.name,
        type: playback.item.type,
        artists: playback.item.type === 'track' ? 
          playback.item.artists.map(artist => artist.name).join(', ') :
          playback.item.show?.name || 'Unknown',
        album: playback.item.type === 'track' ? playback.item.album.name : undefined,
        duration: this.formatDuration(playback.item.duration_ms),
        uri: playback.item.uri,
        external_urls: playback.item.external_urls,
      } : null;

      const device = playback.device ? {
        id: playback.device.id,
        name: playback.device.name,
        type: playback.device.type,
        volume: playback.device.volume_percent,
        is_active: playback.device.is_active,
        is_private_session: playback.device.is_private_session,
        is_restricted: playback.device.is_restricted,
      } : null;

      return {
        success: true,
        data: {
          is_playing: playback.is_playing,
          currently_playing: currentItem,
          device,
          progress: playback.progress_ms,
          progress_formatted: this.formatDuration(playback.progress_ms || 0),
          shuffle_state: playback.shuffle_state,
          repeat_state: playback.repeat_state,
          timestamp: playback.timestamp,
          context: playback.context ? {
            type: playback.context.type,
            uri: playback.context.uri,
            external_urls: playback.context.external_urls,
          } : null,
        },
      };
    } catch (error) {
      if (error instanceof SpotifyAuthError) {
        return {
          success: false,
          error: {
            code: 'AUTH_ERROR',
            message: error.message,
            details: 'Please authenticate with Spotify first',
          },
        };
      }
      
      if (error instanceof SpotifyError) {
        return {
          success: false,
          error: {
            code: error.details.code,
            message: error.message,
            details: error.details,
          },
        };
      }
      
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }

  private formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

/**
 * Tool for getting available devices
 */
export class GetDevicesTool implements MCPTool {
  public readonly name = 'get_devices';
  public readonly description = 'Get available Spotify devices';
  
  public readonly inputSchema = z.object({}).describe('No parameters required');

  constructor(private spotifyClient: ISpotifyClient) {}

  async execute(input: unknown): Promise<ToolResult> {
    try {
      this.inputSchema.parse(input);
      
      const devices = await this.spotifyClient.getAvailableDevices();
      
      const formattedDevices = devices.devices.map(device => ({
        id: device.id,
        name: device.name,
        type: device.type,
        is_active: device.is_active,
        is_private_session: device.is_private_session,
        is_restricted: device.is_restricted,
        volume_percent: device.volume_percent,
        supports_volume: device.supports_volume,
      }));

      const activeDevice = formattedDevices.find(device => device.is_active);

      return {
        success: true,
        data: {
          devices: formattedDevices,
          active_device: activeDevice || null,
          total_devices: formattedDevices.length,
        },
      };
    } catch (error) {
      if (error instanceof SpotifyAuthError) {
        return {
          success: false,
          error: {
            code: 'AUTH_ERROR',
            message: error.message,
            details: 'Please authenticate with Spotify first',
          },
        };
      }
      
      if (error instanceof SpotifyError) {
        return {
          success: false,
          error: {
            code: error.details.code,
            message: error.message,
            details: error.details,
          },
        };
      }
      
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }
}

/**
 * Tool for getting user profile information
 */
export class GetUserProfileTool implements MCPTool {
  public readonly name = 'get_user_profile';
  public readonly description = 'Get current user profile information';
  
  public readonly inputSchema = z.object({}).describe('No parameters required');

  constructor(private spotifyClient: ISpotifyClient) {}

  async execute(input: unknown): Promise<ToolResult> {
    try {
      this.inputSchema.parse(input);
      
      const profile = await this.spotifyClient.getUserProfile();
      
      return {
        success: true,
        data: {
          id: profile.id,
          display_name: profile.display_name,
          email: profile.email,
          country: profile.country,
          product: profile.product,
          followers: profile.followers?.total || 0,
          images: profile.images,
          external_urls: profile.external_urls,
        },
      };
    } catch (error) {
      if (error instanceof SpotifyAuthError) {
        return {
          success: false,
          error: {
            code: 'AUTH_ERROR',
            message: error.message,
            details: 'Please authenticate with Spotify first',
          },
        };
      }
      
      if (error instanceof SpotifyError) {
        return {
          success: false,
          error: {
            code: error.details.code,
            message: error.message,
            details: error.details,
          },
        };
      }
      
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }
}

/**
 * Tool for starting the authentication flow
 */
export class AuthenticateTool implements MCPTool {
  public readonly name = 'authenticate';
  public readonly description = 'Start Spotify authentication flow';
  
  public readonly inputSchema = z.object({}).describe('No parameters required');

  constructor(private authService: IAuthService) {}

  async execute(input: unknown): Promise<ToolResult> {
    try {
      this.inputSchema.parse(input);
      
      // Use a default user ID for the session
      const userId = 'default';
      
      // Check if already authenticated
      const isAuthenticated = await this.authService.isAuthenticated(userId);
      if (isAuthenticated) {
        const _authStatus = await this.authService.getAuthStatus(userId);
        return {
          success: true,
          data: {
            message: 'Already authenticated',
            status: 'authenticated',
            user_id: userId,
          },
        };
      }

      // Start authentication flow
      const authResult = await this.authService.startAuthFlow(userId);
      
      return {
        success: true,
        data: {
          message: 'Authentication flow started',
          auth_url: authResult.authUrl,
          instructions: [
            '1. Open the provided auth_url in your browser',
            '2. Log in to Spotify and authorize the application',
            '3. You will be redirected to a success page',
            '4. The authentication will be completed automatically',
          ],
        },
      };
    } catch (error) {
      if (error instanceof SpotifyError) {
        return {
          success: false,
          error: {
            code: error.details.code,
            message: error.message,
            details: error.details,
          },
        };
      }
      
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }
}

/**
 * Tool for checking authentication status
 */
export class GetAuthStatusTool implements MCPTool {
  public readonly name = 'get_auth_status';
  public readonly description = 'Check current authentication status';
  
  public readonly inputSchema = z.object({}).describe('No parameters required');

  constructor(private authService: IAuthService) {}

  async execute(input: unknown): Promise<ToolResult> {
    try {
      this.inputSchema.parse(input);
      
      // Use default user ID
      const userId = 'default';
      const isAuthenticated = await this.authService.isAuthenticated(userId);
      
      if (!isAuthenticated) {
        return {
          success: true,
          data: {
            authenticated: false,
            user_id: userId,
            message: 'Not authenticated. Use the authenticate tool to start the auth flow.',
          },
        };
      }

      const _authStatus = await this.authService.getAuthStatus(userId);
      
      return {
        success: true,
        data: {
          authenticated: true,
          user_id: userId,
        },
      };
    } catch (error) {
      if (error instanceof SpotifyError) {
        return {
          success: false,
          error: {
            code: error.details.code,
            message: error.message,
            details: error.details,
          },
        };
      }
      
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }
}

/**
 * Factory function to create all status and authentication tools
 */
export function createStatusTools(
  spotifyClient: ISpotifyClient,
  authService: IAuthService
): MCPTool[] {
  return [
    new GetPlaybackStatusTool(spotifyClient),
    new GetDevicesTool(spotifyClient),
    new GetUserProfileTool(spotifyClient),
    new AuthenticateTool(authService),
    new GetAuthStatusTool(authService),
  ];
}