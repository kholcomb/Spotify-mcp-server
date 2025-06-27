/**
 * Spotify status and authentication tools for MCP
 *
 * Provides status checking, authentication management, and user information
 * through the MCP protocol.
 */
import { MCPTool, ToolResult } from '../types/index.js';
import { SpotifyClient as ISpotifyClient } from '../spotify/index.js';
import { AuthService as IAuthService } from '../auth/index.js';
import { z } from 'zod';
/**
 * Tool for getting current playback status
 */
export declare class GetPlaybackStatusTool implements MCPTool {
    private spotifyClient;
    readonly name = "get_playback_status";
    readonly description = "Get current Spotify playback status";
    readonly inputSchema: z.ZodObject<{
        market: z.ZodOptional<z.ZodString>;
        additionalTypes: z.ZodOptional<z.ZodArray<z.ZodEnum<["track", "episode"]>, "many">>;
    }, "strip", z.ZodTypeAny, {
        market?: string | undefined;
        additionalTypes?: ("track" | "episode")[] | undefined;
    }, {
        market?: string | undefined;
        additionalTypes?: ("track" | "episode")[] | undefined;
    }>;
    constructor(spotifyClient: ISpotifyClient);
    execute(input: unknown): Promise<ToolResult>;
    private formatDuration;
}
/**
 * Tool for getting available devices
 */
export declare class GetDevicesTool implements MCPTool {
    private spotifyClient;
    readonly name = "get_devices";
    readonly description = "Get available Spotify devices";
    readonly inputSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
    constructor(spotifyClient: ISpotifyClient);
    execute(input: unknown): Promise<ToolResult>;
}
/**
 * Tool for getting user profile information
 */
export declare class GetUserProfileTool implements MCPTool {
    private spotifyClient;
    readonly name = "get_user_profile";
    readonly description = "Get current user profile information";
    readonly inputSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
    constructor(spotifyClient: ISpotifyClient);
    execute(input: unknown): Promise<ToolResult>;
}
/**
 * Tool for starting the authentication flow
 */
export declare class AuthenticateTool implements MCPTool {
    private authService;
    readonly name = "authenticate";
    readonly description = "Start Spotify authentication flow";
    readonly inputSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
    constructor(authService: IAuthService);
    execute(input: unknown): Promise<ToolResult>;
}
/**
 * Tool for checking authentication status
 */
export declare class GetAuthStatusTool implements MCPTool {
    private authService;
    readonly name = "get_auth_status";
    readonly description = "Check current authentication status";
    readonly inputSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
    constructor(authService: IAuthService);
    execute(input: unknown): Promise<ToolResult>;
}
/**
 * Factory function to create all status and authentication tools
 */
export declare function createStatusTools(spotifyClient: ISpotifyClient, authService: IAuthService): MCPTool[];
//# sourceMappingURL=status.d.ts.map