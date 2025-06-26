# Multi-stage build for Spotify MCP Server
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S spotifymcp -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/build ./build

# Copy configuration files
COPY --from=builder /app/docs ./docs

# Change ownership to non-root user
RUN chown -R spotifymcp:nodejs /app

# Switch to non-root user
USER spotifymcp

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "
    const http = require('http');
    const options = {
      host: 'localhost',
      port: 3000,
      path: '/health',
      timeout: 2000
    };
    const req = http.request(options, (res) => {
      if (res.statusCode === 200) process.exit(0);
      else process.exit(1);
    });
    req.on('error', () => process.exit(1));
    req.end();
  "

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "build/index.js"]

# Labels for metadata
LABEL org.opencontainers.image.title="Spotify MCP Server"
LABEL org.opencontainers.image.description="A Model Context Protocol server for Spotify Web API integration"
LABEL org.opencontainers.image.vendor="Multi-Persona Development Team"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.source="https://github.com/spotify-mcp/server"
LABEL org.opencontainers.image.documentation="https://github.com/spotify-mcp/server/blob/main/docs/README.md"