import { createServer } from 'http';
import { URL } from 'url';
/**
 * OAuth callback server for handling Spotify authorization redirects
 *
 * Provides a temporary HTTP server to capture authorization codes
 * and complete the OAuth 2.0 + PKCE flow.
 */
export class CallbackServer {
    server = null;
    port;
    logger;
    authManager;
    requestCount = new Map();
    requestTimeout = 30000; // 30 seconds
    maxRequestSize = 8192; // 8KB
    constructor(authManager, logger, port = 8080) {
        this.authManager = authManager;
        this.logger = logger;
        this.port = port;
    }
    /**
     * Start the callback server and return the URL for redirects
     */
    async start() {
        if (this.server) {
            throw new Error('Callback server is already running');
        }
        return new Promise((resolve, reject) => {
            this.server = createServer(this.handleRequest.bind(this));
            // Set server timeouts for security
            this.server.timeout = this.requestTimeout;
            this.server.headersTimeout = 10000; // 10 seconds for headers
            this.server.requestTimeout = this.requestTimeout;
            this.server.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    reject(new Error(`Port ${this.port} is already in use. Please ensure no other applications are using this port.`));
                }
                else {
                    reject(error);
                }
            });
            this.server.listen(this.port, 'localhost', () => {
                const baseUrl = `http://localhost:${this.port}`;
                this.logger.info('OAuth callback server started', {
                    port: this.port,
                    callbackUrl: `${baseUrl}/callback`,
                    timeout: this.requestTimeout,
                    maxRequestSize: this.maxRequestSize
                });
                resolve(baseUrl);
            });
        });
    }
    /**
     * Stop the callback server
     */
    async stop() {
        if (!this.server) {
            return;
        }
        return new Promise((resolve, reject) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.server.close((error) => {
                if (error) {
                    this.logger.error('Error stopping callback server', {
                        error: error.message
                    });
                    reject(error);
                }
                else {
                    this.logger.info('OAuth callback server stopped');
                    this.server = null;
                    resolve();
                }
            });
        });
    }
    /**
     * Validate incoming request for security
     */
    validateRequest(req, res) {
        // Only allow GET requests
        if (req.method !== 'GET') {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed');
            return false;
        }
        // Check request size
        const contentLength = req.headers['content-length'];
        if (contentLength && parseInt(contentLength) > this.maxRequestSize) {
            res.writeHead(413, { 'Content-Type': 'text/plain' });
            res.end('Request Entity Too Large');
            return false;
        }
        // Simple rate limiting by IP
        const clientIP = req.socket.remoteAddress || 'unknown';
        const currentCount = this.requestCount.get(clientIP) || 0;
        if (currentCount > 10) { // Max 10 requests per IP
            res.writeHead(429, { 'Content-Type': 'text/plain' });
            res.end('Too Many Requests');
            return false;
        }
        this.requestCount.set(clientIP, currentCount + 1);
        // Clean up old counts every minute
        setTimeout(() => {
            this.requestCount.delete(clientIP);
        }, 60000);
        return true;
    }
    /**
     * Handle HTTP requests to the callback server
     */
    async handleRequest(req, res) {
        // Security validations
        if (!this.validateRequest(req, res)) {
            return;
        }
        const url = new URL(req.url || '/', `http://localhost:${this.port}`);
        // Set security headers
        res.setHeader('Access-Control-Allow-Origin', 'null');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        this.logger.debug('Callback server received request', {
            method: req.method,
            pathname: url.pathname,
            searchParams: Array.from(url.searchParams.keys())
        });
        try {
            if (url.pathname === '/callback') {
                await this.handleCallback(url, res);
            }
            else if (url.pathname === '/health') {
                await this.handleHealth(res);
            }
            else {
                await this.handle404(res);
            }
        }
        catch (error) {
            this.logger.error('Error handling callback request', {
                error: error instanceof Error ? error.message : 'Unknown error',
                pathname: url.pathname
            });
            await this.handleError(res, error);
        }
    }
    /**
     * Handle OAuth callback with authorization code
     */
    async handleCallback(url, res) {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');
        const errorDescription = url.searchParams.get('error_description');
        // Handle OAuth errors
        if (error) {
            this.logger.error('OAuth authorization error', {
                error,
                errorDescription
            });
            const html = this.generateErrorPage('Authorization Failed', `Spotify authorization failed: ${errorDescription || error}`, 'Please close this window and try again.');
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(html);
            return;
        }
        // Validate required parameters
        if (!code || !state) {
            this.logger.error('Missing required OAuth parameters', {
                hasCode: !!code,
                hasState: !!state
            });
            const html = this.generateErrorPage('Invalid Request', 'Missing required authorization parameters.', 'Please close this window and try again.');
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(html);
            return;
        }
        try {
            // For now, we'll use a default user ID since MCP doesn't provide user context
            // In a multi-user scenario, this would need to be handled differently
            const userId = 'default';
            const result = await this.authManager.exchangeCodeForTokens(userId, code, state);
            if (result.success) {
                this.logger.info('OAuth authorization successful', {
                    userId,
                    expiresAt: result.tokens.expiresAt.toISOString()
                });
                const html = this.generateSuccessPage('Authorization Successful!', 'Your Spotify account has been successfully connected.', 'You can now close this window and return to your AI assistant.');
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(html);
            }
            else {
                throw new Error('Token exchange failed');
            }
        }
        catch (authError) {
            this.logger.error('Token exchange failed', {
                error: authError instanceof Error ? authError.message : 'Unknown error'
            });
            const html = this.generateErrorPage('Authentication Error', 'Failed to complete authorization with Spotify.', 'Please close this window and try again.');
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end(html);
        }
    }
    /**
     * Handle health check requests
     */
    async handleHealth(res) {
        const healthData = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            port: this.port
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(healthData, null, 2));
    }
    /**
     * Handle 404 errors
     */
    async handle404(res) {
        const html = this.generateErrorPage('Not Found', 'The requested page was not found.', 'This server only handles OAuth callbacks.');
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(html);
    }
    /**
     * Handle server errors
     */
    async handleError(res, _error) {
        const html = this.generateErrorPage('Server Error', 'An unexpected error occurred.', 'Please try again later.');
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(html);
    }
    /**
     * Generate success HTML page
     */
    generateSuccessPage(title, message, instruction) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1DB954 0%, #1ed760 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            border-radius: 16px;
            padding: 40px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            max-width: 400px;
            width: 100%;
        }
        .icon {
            font-size: 64px;
            margin-bottom: 20px;
        }
        h1 {
            color: #191414;
            margin: 0 0 16px 0;
            font-size: 24px;
            font-weight: 600;
        }
        p {
            color: #535353;
            margin: 0 0 24px 0;
            line-height: 1.5;
        }
        .instruction {
            color: #1DB954;
            font-weight: 500;
            font-size: 14px;
        }
        .close-btn {
            margin-top: 20px;
            padding: 12px 24px;
            background: #1DB954;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 500;
            cursor: pointer;
            font-size: 14px;
        }
        .close-btn:hover {
            background: #1ed760;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">✅</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <p class="instruction">${instruction}</p>
        <button class="close-btn" onclick="window.close()">Close Window</button>
    </div>
    <script>
        // Auto-close after 10 seconds
        setTimeout(() => {
            window.close();
        }, 10000);
    </script>
</body>
</html>`;
    }
    /**
     * Generate error HTML page
     */
    generateErrorPage(title, message, instruction) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            border-radius: 16px;
            padding: 40px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            max-width: 400px;
            width: 100%;
        }
        .icon {
            font-size: 64px;
            margin-bottom: 20px;
        }
        h1 {
            color: #191414;
            margin: 0 0 16px 0;
            font-size: 24px;
            font-weight: 600;
        }
        p {
            color: #535353;
            margin: 0 0 24px 0;
            line-height: 1.5;
        }
        .instruction {
            color: #ff6b6b;
            font-weight: 500;
            font-size: 14px;
        }
        .close-btn {
            margin-top: 20px;
            padding: 12px 24px;
            background: #ff6b6b;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 500;
            cursor: pointer;
            font-size: 14px;
        }
        .close-btn:hover {
            background: #ee5a52;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">❌</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <p class="instruction">${instruction}</p>
        <button class="close-btn" onclick="window.close()">Close Window</button>
    </div>
</body>
</html>`;
    }
}
//# sourceMappingURL=callbackServer.js.map