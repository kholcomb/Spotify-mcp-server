import { z } from 'zod';
const ConfigSchema = z.object({
    spotify: z.object({
        clientId: z.string().min(1, 'Spotify Client ID is required'),
        clientSecret: z.string().min(1, 'Spotify Client Secret is required'),
        redirectUri: z.string().url('Redirect URI must be a valid URL'),
    }),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    tokenEncryptionKey: z.string().optional(),
});
/**
 * Load and validate configuration from environment variables
 */
export function loadConfig() {
    const config = {
        spotify: {
            clientId: process.env.SPOTIFY_CLIENT_ID || '',
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
            redirectUri: process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:8080/callback',
        },
        logLevel: process.env.LOG_LEVEL || 'info',
        tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY,
    };
    try {
        const parsed = ConfigSchema.parse(config);
        const result = {
            spotify: parsed.spotify,
            logLevel: parsed.logLevel
        };
        if (parsed.tokenEncryptionKey) {
            result.tokenEncryptionKey = parsed.tokenEncryptionKey;
        }
        return result;
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            const issues = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
            throw new Error(`Configuration validation failed:\n${issues.join('\n')}`);
        }
        throw error;
    }
}
/**
 * Validate required environment variables are present
 */
export function validateEnvironment() {
    const required = ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET'];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}
//# sourceMappingURL=config.js.map