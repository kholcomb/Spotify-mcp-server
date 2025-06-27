/**
 * Spotify search tools for MCP
 *
 * Provides comprehensive search functionality for tracks, albums, artists,
 * playlists, and recommendations through the MCP protocol.
 */
import { MCPTool, ToolResult } from '../types/index.js';
import { SpotifyClient as ISpotifyClient } from '../spotify/index.js';
import { z } from 'zod';
/**
 * Tool for searching Spotify catalog
 */
export declare class SearchTool implements MCPTool {
    private spotifyClient;
    readonly name = "search";
    readonly description = "Search Spotify catalog for tracks, albums, artists, playlists, and shows";
    readonly inputSchema: z.ZodObject<{
        query: z.ZodString;
        types: z.ZodDefault<z.ZodUnion<[z.ZodArray<z.ZodEnum<["track", "album", "artist", "playlist", "show", "episode"]>, "many">, z.ZodEffects<z.ZodString, ("track" | "episode" | "artist" | "album" | "playlist" | "show")[], string>]>>;
        market: z.ZodOptional<z.ZodString>;
        limit: z.ZodDefault<z.ZodPipeline<z.ZodUnion<[z.ZodNumber, z.ZodEffects<z.ZodString, number, string>]>, z.ZodNumber>>;
        offset: z.ZodDefault<z.ZodPipeline<z.ZodUnion<[z.ZodNumber, z.ZodEffects<z.ZodString, number, string>]>, z.ZodNumber>>;
        includeExternal: z.ZodDefault<z.ZodUnion<[z.ZodBoolean, z.ZodEffects<z.ZodString, boolean, string>]>>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        offset: number;
        query: string;
        types: ("track" | "episode" | "artist" | "album" | "playlist" | "show")[];
        includeExternal: boolean;
        market?: string | undefined;
    }, {
        query: string;
        limit?: string | number | undefined;
        offset?: string | number | undefined;
        market?: string | undefined;
        types?: string | ("track" | "episode" | "artist" | "album" | "playlist" | "show")[] | undefined;
        includeExternal?: string | boolean | undefined;
    }>;
    constructor(spotifyClient: ISpotifyClient);
    execute(input: unknown): Promise<ToolResult>;
    private formatSearchResults;
    private getTotalResults;
    private formatDuration;
}
/**
 * Tool for getting Spotify recommendations
 */
export declare class RecommendationsTool implements MCPTool {
    private spotifyClient;
    readonly name = "get_recommendations";
    readonly description = "Get Spotify recommendations based on seed tracks, artists, or genres";
    readonly inputSchema: z.ZodEffects<z.ZodObject<{
        seedTracks: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        seedArtists: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        seedGenres: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        limit: z.ZodDefault<z.ZodNumber>;
        market: z.ZodOptional<z.ZodString>;
        targetAcousticness: z.ZodOptional<z.ZodNumber>;
        targetDanceability: z.ZodOptional<z.ZodNumber>;
        targetEnergy: z.ZodOptional<z.ZodNumber>;
        targetInstrumentalness: z.ZodOptional<z.ZodNumber>;
        targetLiveness: z.ZodOptional<z.ZodNumber>;
        targetLoudness: z.ZodOptional<z.ZodNumber>;
        targetSpeechiness: z.ZodOptional<z.ZodNumber>;
        targetTempo: z.ZodOptional<z.ZodNumber>;
        targetValence: z.ZodOptional<z.ZodNumber>;
        targetPopularity: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        market?: string | undefined;
        seedTracks?: string[] | undefined;
        seedArtists?: string[] | undefined;
        seedGenres?: string[] | undefined;
        targetAcousticness?: number | undefined;
        targetDanceability?: number | undefined;
        targetEnergy?: number | undefined;
        targetInstrumentalness?: number | undefined;
        targetLiveness?: number | undefined;
        targetLoudness?: number | undefined;
        targetSpeechiness?: number | undefined;
        targetTempo?: number | undefined;
        targetValence?: number | undefined;
        targetPopularity?: number | undefined;
    }, {
        limit?: number | undefined;
        market?: string | undefined;
        seedTracks?: string[] | undefined;
        seedArtists?: string[] | undefined;
        seedGenres?: string[] | undefined;
        targetAcousticness?: number | undefined;
        targetDanceability?: number | undefined;
        targetEnergy?: number | undefined;
        targetInstrumentalness?: number | undefined;
        targetLiveness?: number | undefined;
        targetLoudness?: number | undefined;
        targetSpeechiness?: number | undefined;
        targetTempo?: number | undefined;
        targetValence?: number | undefined;
        targetPopularity?: number | undefined;
    }>, {
        limit: number;
        market?: string | undefined;
        seedTracks?: string[] | undefined;
        seedArtists?: string[] | undefined;
        seedGenres?: string[] | undefined;
        targetAcousticness?: number | undefined;
        targetDanceability?: number | undefined;
        targetEnergy?: number | undefined;
        targetInstrumentalness?: number | undefined;
        targetLiveness?: number | undefined;
        targetLoudness?: number | undefined;
        targetSpeechiness?: number | undefined;
        targetTempo?: number | undefined;
        targetValence?: number | undefined;
        targetPopularity?: number | undefined;
    }, {
        limit?: number | undefined;
        market?: string | undefined;
        seedTracks?: string[] | undefined;
        seedArtists?: string[] | undefined;
        seedGenres?: string[] | undefined;
        targetAcousticness?: number | undefined;
        targetDanceability?: number | undefined;
        targetEnergy?: number | undefined;
        targetInstrumentalness?: number | undefined;
        targetLiveness?: number | undefined;
        targetLoudness?: number | undefined;
        targetSpeechiness?: number | undefined;
        targetTempo?: number | undefined;
        targetValence?: number | undefined;
        targetPopularity?: number | undefined;
    }>;
    constructor(spotifyClient: ISpotifyClient);
    execute(input: unknown): Promise<ToolResult>;
    private formatDuration;
}
/**
 * Factory function to create all search tools
 */
export declare function createSearchTools(spotifyClient: ISpotifyClient): MCPTool[];
//# sourceMappingURL=search.d.ts.map