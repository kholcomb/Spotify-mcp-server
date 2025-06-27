/**
 * Spotify playback control tools for MCP
 *
 * Provides comprehensive playback control functionality including play, pause,
 * skip, volume, shuffle, and repeat controls through the MCP protocol.
 */
import { SpotifyError, SpotifyDeviceError, SpotifyPremiumRequiredError } from '../spotify/errors.js';
import { z } from 'zod';
/**
 * Tool for starting/resuming playback
 */
export class PlayTool {
    spotifyClient;
    name = 'play';
    description = 'Start or resume Spotify playback';
    inputSchema = z.object({
        deviceId: z.string().optional().describe('Specific device ID to play on'),
        contextUri: z.string().optional().describe('Spotify URI to play (playlist, album, artist)'),
        uris: z.array(z.string()).optional().describe('Array of track URIs to play'),
        position: z.number().min(0).optional().describe('Position to start playback (milliseconds)'),
    }).describe('Playback control options');
    constructor(spotifyClient) {
        this.spotifyClient = spotifyClient;
    }
    async execute(input) {
        try {
            const params = this.inputSchema.parse(input);
            const playbackOptions = {};
            if (params.deviceId) {
                playbackOptions.device_id = params.deviceId;
            }
            if (params.contextUri) {
                playbackOptions.context_uri = params.contextUri;
            }
            if (params.uris && params.uris.length > 0) {
                playbackOptions.uris = params.uris;
            }
            if (params.position !== undefined) {
                playbackOptions.position_ms = params.position;
            }
            await this.spotifyClient.startPlayback(playbackOptions);
            return {
                success: true,
                data: {
                    message: 'Playback started successfully',
                    options: playbackOptions,
                },
            };
        }
        catch (error) {
            if (error instanceof SpotifyDeviceError) {
                return {
                    success: false,
                    error: {
                        code: 'DEVICE_ERROR',
                        message: error.message,
                        details: 'Please start Spotify on a device and try again',
                    },
                };
            }
            if (error instanceof SpotifyPremiumRequiredError) {
                return {
                    success: false,
                    error: {
                        code: 'PREMIUM_REQUIRED',
                        message: error.message,
                        details: 'Spotify Premium subscription required for playback control',
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
 * Tool for pausing playback
 */
export class PauseTool {
    spotifyClient;
    name = 'pause';
    description = 'Pause Spotify playback';
    inputSchema = z.object({
        deviceId: z.string().optional().describe('Specific device ID to pause'),
    }).describe('Pause playback options');
    constructor(spotifyClient) {
        this.spotifyClient = spotifyClient;
    }
    async execute(input) {
        try {
            const params = this.inputSchema.parse(input);
            await this.spotifyClient.pausePlayback(params.deviceId);
            return {
                success: true,
                data: {
                    message: 'Playback paused successfully',
                },
            };
        }
        catch (error) {
            if (error instanceof SpotifyDeviceError) {
                return {
                    success: false,
                    error: {
                        code: 'DEVICE_ERROR',
                        message: error.message,
                        details: 'No active device found to pause',
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
 * Tool for skipping to next track
 */
export class SkipNextTool {
    spotifyClient;
    name = 'skip_next';
    description = 'Skip to the next track';
    inputSchema = z.object({
        deviceId: z.string().optional().describe('Specific device ID to skip on'),
    }).describe('Skip to next track options');
    constructor(spotifyClient) {
        this.spotifyClient = spotifyClient;
    }
    async execute(input) {
        try {
            const params = this.inputSchema.parse(input);
            await this.spotifyClient.skipToNext(params.deviceId);
            return {
                success: true,
                data: {
                    message: 'Skipped to next track successfully',
                },
            };
        }
        catch (error) {
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
 * Tool for skipping to previous track
 */
export class SkipPreviousTool {
    spotifyClient;
    name = 'skip_previous';
    description = 'Skip to the previous track';
    inputSchema = z.object({
        deviceId: z.string().optional().describe('Specific device ID to skip on'),
    }).describe('Skip to previous track options');
    constructor(spotifyClient) {
        this.spotifyClient = spotifyClient;
    }
    async execute(input) {
        try {
            const params = this.inputSchema.parse(input);
            await this.spotifyClient.skipToPrevious(params.deviceId);
            return {
                success: true,
                data: {
                    message: 'Skipped to previous track successfully',
                },
            };
        }
        catch (error) {
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
 * Tool for setting volume
 */
export class SetVolumeTool {
    spotifyClient;
    name = 'set_volume';
    description = 'Set playback volume (0-100)';
    inputSchema = z.object({
        volume: z.number().min(0).max(100).describe('Volume level (0-100)'),
        deviceId: z.string().optional().describe('Specific device ID to set volume on'),
    }).describe('Volume control options');
    constructor(spotifyClient) {
        this.spotifyClient = spotifyClient;
    }
    async execute(input) {
        try {
            const params = this.inputSchema.parse(input);
            await this.spotifyClient.setVolume(params.volume, params.deviceId);
            return {
                success: true,
                data: {
                    message: `Volume set to ${params.volume}%`,
                    volume: params.volume,
                },
            };
        }
        catch (error) {
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
 * Tool for toggling shuffle mode
 */
export class SetShuffleTool {
    spotifyClient;
    name = 'set_shuffle';
    description = 'Toggle shuffle mode on/off';
    inputSchema = z.object({
        shuffle: z.boolean().describe('Enable (true) or disable (false) shuffle'),
        deviceId: z.string().optional().describe('Specific device ID to set shuffle on'),
    }).describe('Shuffle control options');
    constructor(spotifyClient) {
        this.spotifyClient = spotifyClient;
    }
    async execute(input) {
        try {
            const params = this.inputSchema.parse(input);
            await this.spotifyClient.setShuffle(params.shuffle, params.deviceId);
            return {
                success: true,
                data: {
                    message: `Shuffle ${params.shuffle ? 'enabled' : 'disabled'}`,
                    shuffle: params.shuffle,
                },
            };
        }
        catch (error) {
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
 * Tool for setting repeat mode
 */
export class SetRepeatTool {
    spotifyClient;
    name = 'set_repeat';
    description = 'Set repeat mode (off, track, context)';
    inputSchema = z.object({
        repeat: z.enum(['off', 'track', 'context']).describe('Repeat mode: off, track, or context'),
        deviceId: z.string().optional().describe('Specific device ID to set repeat on'),
    }).describe('Repeat control options');
    constructor(spotifyClient) {
        this.spotifyClient = spotifyClient;
    }
    async execute(input) {
        try {
            const params = this.inputSchema.parse(input);
            await this.spotifyClient.setRepeat(params.repeat, params.deviceId);
            return {
                success: true,
                data: {
                    message: `Repeat mode set to ${params.repeat}`,
                    repeat: params.repeat,
                },
            };
        }
        catch (error) {
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
 * Tool for seeking to specific position in track
 */
export class SeekTool {
    spotifyClient;
    name = 'seek';
    description = 'Seek to specific position in current track';
    inputSchema = z.object({
        position: z.number().min(0).describe('Position to seek to (milliseconds)'),
        deviceId: z.string().optional().describe('Specific device ID to seek on'),
    }).describe('Seek position options');
    constructor(spotifyClient) {
        this.spotifyClient = spotifyClient;
    }
    async execute(input) {
        try {
            const params = this.inputSchema.parse(input);
            await this.spotifyClient.seek(params.position, params.deviceId);
            return {
                success: true,
                data: {
                    message: `Seeked to position ${Math.floor(params.position / 1000)}s`,
                    position: params.position,
                },
            };
        }
        catch (error) {
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
 * Tool for transferring playback to different device
 */
export class TransferPlaybackTool {
    spotifyClient;
    name = 'transfer_playback';
    description = 'Transfer playback to a different device';
    inputSchema = z.object({
        deviceId: z.string().describe('Device ID to transfer playback to'),
        play: z.boolean().default(true).describe('Whether to ensure playback is active after transfer'),
    }).describe('Playback transfer options');
    constructor(spotifyClient) {
        this.spotifyClient = spotifyClient;
    }
    async execute(input) {
        try {
            const params = this.inputSchema.parse(input);
            await this.spotifyClient.transferPlayback([params.deviceId], params.play);
            return {
                success: true,
                data: {
                    message: 'Playback transferred successfully',
                    deviceId: params.deviceId,
                    play: params.play,
                },
            };
        }
        catch (error) {
            if (error instanceof SpotifyDeviceError) {
                return {
                    success: false,
                    error: {
                        code: 'DEVICE_ERROR',
                        message: error.message,
                        details: 'Check that the target device is available and active',
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
 * Factory function to create all playback tools
 */
export function createPlaybackTools(spotifyClient) {
    return [
        new PlayTool(spotifyClient),
        new PauseTool(spotifyClient),
        new SkipNextTool(spotifyClient),
        new SkipPreviousTool(spotifyClient),
        new SetVolumeTool(spotifyClient),
        new SetShuffleTool(spotifyClient),
        new SetRepeatTool(spotifyClient),
        new SeekTool(spotifyClient),
        new TransferPlaybackTool(spotifyClient),
    ];
}
//# sourceMappingURL=playback.js.map