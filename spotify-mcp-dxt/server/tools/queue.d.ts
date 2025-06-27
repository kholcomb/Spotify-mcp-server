/**
 * Spotify queue management tools for MCP
 *
 * Provides queue management functionality including adding tracks to queue,
 * viewing queue contents, and queue manipulation through the MCP protocol.
 */
import { MCPTool, ToolResult } from '../types/index.js';
import { SpotifyClient as ISpotifyClient } from '../spotify/index.js';
import { z } from 'zod';
/**
 * Tool for adding tracks to the playback queue
 */
export declare class AddToQueueTool implements MCPTool {
    private spotifyClient;
    readonly name = "add_to_queue";
    readonly description = "Add a track to the Spotify playback queue";
    readonly inputSchema: z.ZodObject<{
        uri: z.ZodString;
        deviceId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        uri: string;
        deviceId?: string | undefined;
    }, {
        uri: string;
        deviceId?: string | undefined;
    }>;
    constructor(spotifyClient: ISpotifyClient);
    execute(input: unknown): Promise<ToolResult>;
    private isValidTrackUri;
    private extractTrackId;
}
/**
 * Tool for viewing the current playback queue
 */
export declare class GetQueueTool implements MCPTool {
    private spotifyClient;
    readonly name = "get_queue";
    readonly description = "Get the current Spotify playback queue";
    readonly inputSchema: z.ZodObject<{
        limit: z.ZodDefault<z.ZodPipeline<z.ZodUnion<[z.ZodNumber, z.ZodEffects<z.ZodString, number, string>]>, z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
    }, {
        limit?: string | number | undefined;
    }>;
    constructor(spotifyClient: ISpotifyClient);
    execute(input: unknown): Promise<ToolResult>;
    private formatDuration;
}
/**
 * Tool for adding multiple tracks to queue from a playlist or album
 */
export declare class AddPlaylistToQueueTool implements MCPTool {
    private spotifyClient;
    readonly name = "add_playlist_to_queue";
    readonly description = "Add tracks from a playlist or album to the queue";
    readonly inputSchema: z.ZodObject<{
        uri: z.ZodString;
        limit: z.ZodDefault<z.ZodNumber>;
        offset: z.ZodDefault<z.ZodNumber>;
        shuffle: z.ZodDefault<z.ZodBoolean>;
        deviceId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        uri: string;
        limit: number;
        offset: number;
        shuffle: boolean;
        deviceId?: string | undefined;
    }, {
        uri: string;
        limit?: number | undefined;
        deviceId?: string | undefined;
        offset?: number | undefined;
        shuffle?: boolean | undefined;
    }>;
    constructor(spotifyClient: ISpotifyClient);
    execute(input: unknown): Promise<ToolResult>;
    private isValidPlaylistOrAlbumUri;
    private extractId;
    private shuffleArray;
    private delay;
}
/**
 * Tool for clearing the current queue
 */
export declare class ClearQueueTool implements MCPTool {
    private spotifyClient;
    readonly name = "clear_queue";
    readonly description = "Clear the current playback queue";
    readonly inputSchema: z.ZodObject<{
        deviceId: z.ZodOptional<z.ZodString>;
        keepCurrent: z.ZodDefault<z.ZodUnion<[z.ZodBoolean, z.ZodEffects<z.ZodString, boolean, string>]>>;
    }, "strip", z.ZodTypeAny, {
        keepCurrent: boolean;
        deviceId?: string | undefined;
    }, {
        deviceId?: string | undefined;
        keepCurrent?: string | boolean | undefined;
    }>;
    constructor(spotifyClient: ISpotifyClient);
    execute(input: unknown): Promise<ToolResult>;
}
/**
 * Factory function to create all queue management tools
 */
export declare function createQueueTools(spotifyClient: ISpotifyClient): MCPTool[];
//# sourceMappingURL=queue.d.ts.map