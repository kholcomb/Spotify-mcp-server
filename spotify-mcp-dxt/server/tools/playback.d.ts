/**
 * Spotify playback control tools for MCP
 *
 * Provides comprehensive playback control functionality including play, pause,
 * skip, volume, shuffle, and repeat controls through the MCP protocol.
 */
import { MCPTool, ToolResult } from '../types/index.js';
import { SpotifyClient as ISpotifyClient } from '../spotify/index.js';
import { z } from 'zod';
/**
 * Tool for starting/resuming playback
 */
export declare class PlayTool implements MCPTool {
    private spotifyClient;
    readonly name = "play";
    readonly description = "Start or resume Spotify playback";
    readonly inputSchema: z.ZodObject<{
        deviceId: z.ZodOptional<z.ZodString>;
        contextUri: z.ZodOptional<z.ZodString>;
        uris: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        position: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        deviceId?: string | undefined;
        contextUri?: string | undefined;
        uris?: string[] | undefined;
        position?: number | undefined;
    }, {
        deviceId?: string | undefined;
        contextUri?: string | undefined;
        uris?: string[] | undefined;
        position?: number | undefined;
    }>;
    constructor(spotifyClient: ISpotifyClient);
    execute(input: unknown): Promise<ToolResult>;
}
/**
 * Tool for pausing playback
 */
export declare class PauseTool implements MCPTool {
    private spotifyClient;
    readonly name = "pause";
    readonly description = "Pause Spotify playback";
    readonly inputSchema: z.ZodObject<{
        deviceId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        deviceId?: string | undefined;
    }, {
        deviceId?: string | undefined;
    }>;
    constructor(spotifyClient: ISpotifyClient);
    execute(input: unknown): Promise<ToolResult>;
}
/**
 * Tool for skipping to next track
 */
export declare class SkipNextTool implements MCPTool {
    private spotifyClient;
    readonly name = "skip_next";
    readonly description = "Skip to the next track";
    readonly inputSchema: z.ZodObject<{
        deviceId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        deviceId?: string | undefined;
    }, {
        deviceId?: string | undefined;
    }>;
    constructor(spotifyClient: ISpotifyClient);
    execute(input: unknown): Promise<ToolResult>;
}
/**
 * Tool for skipping to previous track
 */
export declare class SkipPreviousTool implements MCPTool {
    private spotifyClient;
    readonly name = "skip_previous";
    readonly description = "Skip to the previous track";
    readonly inputSchema: z.ZodObject<{
        deviceId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        deviceId?: string | undefined;
    }, {
        deviceId?: string | undefined;
    }>;
    constructor(spotifyClient: ISpotifyClient);
    execute(input: unknown): Promise<ToolResult>;
}
/**
 * Tool for setting volume
 */
export declare class SetVolumeTool implements MCPTool {
    private spotifyClient;
    readonly name = "set_volume";
    readonly description = "Set playback volume (0-100)";
    readonly inputSchema: z.ZodObject<{
        volume: z.ZodNumber;
        deviceId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        volume: number;
        deviceId?: string | undefined;
    }, {
        volume: number;
        deviceId?: string | undefined;
    }>;
    constructor(spotifyClient: ISpotifyClient);
    execute(input: unknown): Promise<ToolResult>;
}
/**
 * Tool for toggling shuffle mode
 */
export declare class SetShuffleTool implements MCPTool {
    private spotifyClient;
    readonly name = "set_shuffle";
    readonly description = "Toggle shuffle mode on/off";
    readonly inputSchema: z.ZodObject<{
        shuffle: z.ZodBoolean;
        deviceId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        shuffle: boolean;
        deviceId?: string | undefined;
    }, {
        shuffle: boolean;
        deviceId?: string | undefined;
    }>;
    constructor(spotifyClient: ISpotifyClient);
    execute(input: unknown): Promise<ToolResult>;
}
/**
 * Tool for setting repeat mode
 */
export declare class SetRepeatTool implements MCPTool {
    private spotifyClient;
    readonly name = "set_repeat";
    readonly description = "Set repeat mode (off, track, context)";
    readonly inputSchema: z.ZodObject<{
        repeat: z.ZodEnum<["off", "track", "context"]>;
        deviceId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        repeat: "track" | "off" | "context";
        deviceId?: string | undefined;
    }, {
        repeat: "track" | "off" | "context";
        deviceId?: string | undefined;
    }>;
    constructor(spotifyClient: ISpotifyClient);
    execute(input: unknown): Promise<ToolResult>;
}
/**
 * Tool for seeking to specific position in track
 */
export declare class SeekTool implements MCPTool {
    private spotifyClient;
    readonly name = "seek";
    readonly description = "Seek to specific position in current track";
    readonly inputSchema: z.ZodObject<{
        position: z.ZodNumber;
        deviceId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        position: number;
        deviceId?: string | undefined;
    }, {
        position: number;
        deviceId?: string | undefined;
    }>;
    constructor(spotifyClient: ISpotifyClient);
    execute(input: unknown): Promise<ToolResult>;
}
/**
 * Tool for transferring playback to different device
 */
export declare class TransferPlaybackTool implements MCPTool {
    private spotifyClient;
    readonly name = "transfer_playback";
    readonly description = "Transfer playback to a different device";
    readonly inputSchema: z.ZodObject<{
        deviceId: z.ZodString;
        play: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        deviceId: string;
        play: boolean;
    }, {
        deviceId: string;
        play?: boolean | undefined;
    }>;
    constructor(spotifyClient: ISpotifyClient);
    execute(input: unknown): Promise<ToolResult>;
}
/**
 * Factory function to create all playback tools
 */
export declare function createPlaybackTools(spotifyClient: ISpotifyClient): MCPTool[];
//# sourceMappingURL=playback.d.ts.map