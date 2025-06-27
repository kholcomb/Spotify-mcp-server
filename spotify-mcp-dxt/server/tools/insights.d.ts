/**
 * Spotify user insights tools for MCP
 *
 * Provides user listening analytics, top content, and library access
 * through the MCP protocol.
 */
import { MCPTool, ToolResult } from '../types/index.js';
import { SpotifyClient as ISpotifyClient } from '../spotify/index.js';
import { z } from 'zod';
/**
 * Tool for getting user's top tracks
 */
export declare class GetUserTopTracksTool implements MCPTool {
    private spotifyClient;
    readonly name = "get_user_top_tracks";
    readonly description = "Get user's top tracks based on listening history";
    readonly inputSchema: z.ZodObject<{
        time_range: z.ZodOptional<z.ZodEnum<["short_term", "medium_term", "long_term"]>>;
        limit: z.ZodOptional<z.ZodNumber>;
        offset: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        limit?: number | undefined;
        offset?: number | undefined;
        time_range?: "short_term" | "medium_term" | "long_term" | undefined;
    }, {
        limit?: number | undefined;
        offset?: number | undefined;
        time_range?: "short_term" | "medium_term" | "long_term" | undefined;
    }>;
    constructor(spotifyClient: ISpotifyClient);
    execute(input: unknown): Promise<ToolResult>;
}
/**
 * Tool for getting user's top artists
 */
export declare class GetUserTopArtistsTool implements MCPTool {
    private spotifyClient;
    readonly name = "get_user_top_artists";
    readonly description = "Get user's top artists based on listening history";
    readonly inputSchema: z.ZodObject<{
        time_range: z.ZodOptional<z.ZodEnum<["short_term", "medium_term", "long_term"]>>;
        limit: z.ZodOptional<z.ZodNumber>;
        offset: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        limit?: number | undefined;
        offset?: number | undefined;
        time_range?: "short_term" | "medium_term" | "long_term" | undefined;
    }, {
        limit?: number | undefined;
        offset?: number | undefined;
        time_range?: "short_term" | "medium_term" | "long_term" | undefined;
    }>;
    constructor(spotifyClient: ISpotifyClient);
    execute(input: unknown): Promise<ToolResult>;
}
/**
 * Tool for getting audio features of a track
 */
export declare class GetAudioFeaturesTool implements MCPTool {
    private spotifyClient;
    readonly name = "get_audio_features";
    readonly description = "Get detailed audio features and analysis for a track";
    readonly inputSchema: z.ZodObject<{
        track_id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        track_id: string;
    }, {
        track_id: string;
    }>;
    constructor(spotifyClient: ISpotifyClient);
    execute(input: unknown): Promise<ToolResult>;
    private getKeyName;
}
/**
 * Tool for getting user's saved tracks
 */
export declare class GetUserSavedTracksTool implements MCPTool {
    private spotifyClient;
    readonly name = "get_user_saved_tracks";
    readonly description = "Get tracks saved in user's library (liked songs)";
    readonly inputSchema: z.ZodObject<{
        limit: z.ZodOptional<z.ZodNumber>;
        offset: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        limit?: number | undefined;
        offset?: number | undefined;
    }, {
        limit?: number | undefined;
        offset?: number | undefined;
    }>;
    constructor(spotifyClient: ISpotifyClient);
    execute(input: unknown): Promise<ToolResult>;
}
/**
 * Tool for getting user's saved albums
 */
export declare class GetUserSavedAlbumsTool implements MCPTool {
    private spotifyClient;
    readonly name = "get_user_saved_albums";
    readonly description = "Get albums saved in user's library";
    readonly inputSchema: z.ZodObject<{
        limit: z.ZodOptional<z.ZodNumber>;
        offset: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        limit?: number | undefined;
        offset?: number | undefined;
    }, {
        limit?: number | undefined;
        offset?: number | undefined;
    }>;
    constructor(spotifyClient: ISpotifyClient);
    execute(input: unknown): Promise<ToolResult>;
}
/**
 * Tool for getting user's followed artists
 */
export declare class GetUserFollowedArtistsTool implements MCPTool {
    private spotifyClient;
    readonly name = "get_user_followed_artists";
    readonly description = "Get artists followed by the user";
    readonly inputSchema: z.ZodObject<{
        limit: z.ZodOptional<z.ZodNumber>;
        after: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        limit?: number | undefined;
        after?: string | undefined;
    }, {
        limit?: number | undefined;
        after?: string | undefined;
    }>;
    constructor(spotifyClient: ISpotifyClient);
    execute(input: unknown): Promise<ToolResult>;
}
/**
 * Factory function to create all user insights tools
 */
export declare function createInsightsTools(spotifyClient: ISpotifyClient): MCPTool[];
//# sourceMappingURL=insights.d.ts.map