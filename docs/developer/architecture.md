# Spotify MCP Server Architecture

This document provides a technical overview of the Spotify MCP Server architecture, implementation patterns, and design decisions.

## High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Client    │    │   MCP Server    │    │   Spotify API   │
│  (Claude, etc.) │◄──►│    (stdio)      │◄──►│   (HTTPS/REST)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ OAuth Provider  │
                       │ (Spotify Auth)  │
                       └─────────────────┘
```

## Core Components

### 1. MCP Protocol Layer (`src/server/`)

**Purpose**: Handles Model Context Protocol communication with AI clients.

**Key Responsibilities:**
- JSON-RPC 2.0 message handling over stdio transport
- Tool registration and discovery
- Request/response serialization
- Error handling and logging

**Implementation Pattern:**
```typescript
// MCP Server Core
class MCPServer {
  private tools: Map<string, MCPTool> = new Map();
  
  async handleRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    // Route to appropriate tool handler
    // Handle errors and logging
    // Return standardized response
  }
}
```

### 2. Authentication Layer (`src/auth/`)

**Purpose**: Manages OAuth 2.0 + PKCE authentication with Spotify.

**Key Responsibilities:**
- OAuth authorization code flow with PKCE
- Secure token storage with AES-256 encryption
- Automatic token refresh
- Multi-user session management

**Implementation Pattern:**
```typescript
// Authentication Manager
class AuthManager {
  async authenticate(userId: string): Promise<AuthResult> {
    // Generate PKCE code verifier and challenge
    // Create authorization URL
    // Handle callback and token exchange
    // Store encrypted tokens
  }
  
  async refreshToken(userId: string): Promise<AccessToken> {
    // Check token expiry
    // Refresh if needed
    // Update stored tokens
  }
}
```

**Security Features:**
- PKCE (RFC 7636) implementation for enhanced security
- AES-256 encryption for token storage
- Secure random code generation
- State parameter CSRF protection

### 3. Spotify Integration Layer (`src/spotify/`)

**Purpose**: Provides rate-limited, error-resilient Spotify API client.

**Key Responsibilities:**
- HTTP client with automatic retry logic
- Rate limiting compliance (30-second rolling window)
- Request queuing and caching
- Error mapping from Spotify to MCP format

**Implementation Pattern:**
```typescript
// Spotify API Client
class SpotifyClient {
  private requestQueue: RequestQueue;
  private rateLimiter: RateLimiter;
  
  async apiCall<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    // Check rate limits
    // Queue request if needed
    // Handle authentication
    // Retry on transient errors
    // Map errors to standard format
  }
}
```

**Rate Limiting Strategy:**
- Token bucket algorithm for request management
- Automatic queue processing
- Exponential backoff for 429 responses
- Request deduplication for identical calls

### 4. Tool Implementation Layer (`src/tools/`)

**Purpose**: Implements specific MCP tools for Spotify functionality.

**Tool Categories:**

#### Playback Control Tools
- `play` - Start/resume playback
- `pause` - Pause playback  
- `skip_next` / `skip_previous` - Track navigation
- `set_volume` - Volume control
- `toggle_shuffle` / `set_repeat` - Playback modes

#### Search and Discovery Tools
- `search` - Universal catalog search
- `get_recommendations` - Personalized recommendations

#### Queue Management Tools
- `add_to_queue` - Add tracks to queue
- `get_queue` - View current queue

#### User Data Tools
- `get_current_playback` - Current playback state
- `get_user_profile` - User profile information
- `get_user_playlists` - User's playlists
- `get_recently_played` - Listening history

**Tool Implementation Pattern:**
```typescript
// Base Tool Interface
interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  handler: (input: unknown, context: ToolContext) => Promise<ToolResult>;
}

// Example Tool Implementation
class PlayTool implements MCPTool {
  name = 'play';
  description = 'Start or resume Spotify playback';
  
  inputSchema = z.object({
    device_id: z.string().optional(),
    context_uri: z.string().optional(),
    uris: z.array(z.string()).optional(),
  });
  
  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = this.inputSchema.parse(input);
    const result = await context.spotify.startPlayback(params);
    return { success: true, data: result };
  }
}
```

### 5. Type System (`src/types/`)

**Purpose**: Provides comprehensive TypeScript types for type safety.

**Key Type Categories:**
- **Configuration Types**: Server and authentication configuration
- **Spotify Data Types**: API response models (tracks, albums, playlists)
- **MCP Protocol Types**: Tool schemas and response formats
- **Internal Types**: Request/response interfaces and error types

**Type Safety Benefits:**
- Compile-time error detection
- IntelliSense support in IDEs
- Self-documenting code interfaces
- Runtime validation with Zod schemas

### 6. Utility Layer (`src/utils/`)

**Purpose**: Shared utilities and helper functions.

**Components:**
- **Logger**: Structured JSON logging with configurable levels
- **Config**: Environment variable loading and validation
- **Validation**: Zod schema utilities for input validation
- **Encryption**: Token encryption/decryption utilities

## Data Flow

### 1. Request Processing Flow

```
MCP Client Request
       ↓
JSON-RPC Parsing
       ↓
Tool Identification
       ↓
Input Validation (Zod)
       ↓
Authentication Check
       ↓
Tool Handler Execution
       ↓
Spotify API Call
       ↓
Response Formatting
       ↓
MCP Client Response
```

### 2. Authentication Flow

```
First Request
       ↓
Check Stored Tokens
       ↓
If Missing/Expired:
  Generate PKCE Challenge
       ↓
  Create Auth URL
       ↓
  User Browser Auth
       ↓
  Token Exchange
       ↓
  Encrypt & Store Tokens
       ↓
Use Valid Token for API
```

### 3. Error Handling Flow

```
Error Occurs
       ↓
Classify Error Type
       ↓
Map to MCP Error Code
       ↓
Log Error Details
       ↓
Return User-Friendly Message
       ↓
Trigger Recovery Action
```

## Design Patterns

### 1. Factory Pattern
Used for tool registration and instantiation:
```typescript
class ToolFactory {
  static createTool(name: string): MCPTool {
    const toolMap = {
      'play': () => new PlayTool(),
      'search': () => new SearchTool(),
      // ...
    };
    return toolMap[name]?.();
  }
}
```

### 2. Strategy Pattern
Used for different authentication flows and error handling:
```typescript
interface AuthStrategy {
  authenticate(config: AuthConfig): Promise<AuthResult>;
}

class PKCEAuthStrategy implements AuthStrategy {
  async authenticate(config: AuthConfig): Promise<AuthResult> {
    // PKCE-specific implementation
  }
}
```

### 3. Decorator Pattern
Used for cross-cutting concerns like logging and validation:
```typescript
function withLogging<T extends MCPTool>(tool: T): T {
  const originalHandler = tool.handler;
  tool.handler = async (input, context) => {
    context.logger.info(`Executing tool: ${tool.name}`);
    const result = await originalHandler(input, context);
    context.logger.info(`Tool completed: ${tool.name}`);
    return result;
  };
  return tool;
}
```

### 4. Repository Pattern
Used for data access abstraction:
```typescript
interface TokenRepository {
  store(userId: string, tokens: AuthTokens): Promise<void>;
  retrieve(userId: string): Promise<AuthTokens | null>;
  delete(userId: string): Promise<void>;
}

class EncryptedFileTokenRepository implements TokenRepository {
  // File-based encrypted storage implementation
}
```

## Performance Considerations

### 1. Caching Strategy
- **Token Caching**: In-memory cache for valid access tokens
- **API Response Caching**: Cache non-real-time data (user profile, playlists)
- **Request Deduplication**: Avoid duplicate concurrent requests

### 2. Rate Limiting
- **Token Bucket Algorithm**: Smooth rate limiting with burst capability
- **Request Queuing**: FIFO queue for rate-limited requests
- **Intelligent Scheduling**: Priority-based request scheduling

### 3. Memory Management
- **Streaming Responses**: For large datasets (long playlists)
- **Connection Pooling**: Reuse HTTP connections
- **Garbage Collection**: Proper cleanup of event listeners and timers

## Security Architecture

### 1. Authentication Security
- **OAuth 2.0 + PKCE**: Industry standard secure authentication
- **Token Encryption**: AES-256 encryption for stored tokens
- **Secure Random Generation**: Cryptographically secure PKCE codes
- **Token Rotation**: Regular token refresh and rotation

### 2. Input Security
- **Comprehensive Validation**: All inputs validated with Zod schemas
- **Type Safety**: TypeScript prevents type-related vulnerabilities
- **Sanitization**: Automatic sanitization of user inputs
- **Error Boundaries**: Controlled error handling without information leakage

### 3. Network Security
- **HTTPS Only**: All external communications use TLS
- **Certificate Validation**: Strict certificate validation
- **Timeout Handling**: Prevent hanging requests
- **Request Size Limits**: Protect against large payload attacks

## Monitoring and Observability

### 1. Structured Logging
```json
{
  "timestamp": "2025-06-25T15:00:00Z",
  "level": "INFO",
  "component": "spotify-client",
  "operation": "search",
  "duration_ms": 150,
  "success": true
}
```

### 2. Metrics Collection
- **Request Counts**: Track tool usage and success rates
- **Response Times**: Monitor performance across all operations
- **Error Rates**: Track error frequency by type and component
- **Rate Limit Status**: Monitor API quota usage

### 3. Health Monitoring
- **Health Check Tool**: Built-in MCP tool for status monitoring
- **Dependency Status**: Monitor Spotify API availability
- **Authentication Status**: Track token validity and refresh rates
- **Performance Metrics**: Memory usage and response time tracking

## Testing Strategy

### 1. Unit Testing
- **Tool Logic**: Test individual tool implementations
- **Utility Functions**: Test helper functions and utilities
- **Type Validation**: Test Zod schema validation
- **Error Handling**: Test error scenarios and recovery

### 2. Integration Testing
- **Spotify API**: Test API client with mocked responses
- **Authentication**: Test OAuth flow with test credentials
- **MCP Protocol**: Test protocol compliance with mock clients
- **End-to-End**: Test complete request/response cycles

### 3. Performance Testing
- **Load Testing**: Test concurrent request handling
- **Rate Limit Testing**: Verify rate limiting behavior
- **Memory Testing**: Monitor memory usage under load
- **Response Time Testing**: Validate performance requirements

## Deployment Architecture

### 1. Process Model
- **Single Process**: MCP server runs as single Node.js process
- **stdio Transport**: Direct communication with MCP client
- **Graceful Shutdown**: Proper signal handling and cleanup
- **Error Recovery**: Automatic restart on uncaught exceptions

### 2. Configuration Management
- **Environment Variables**: All configuration via environment
- **Validation**: Startup validation of all required configuration
- **Defaults**: Sensible defaults for optional configuration
- **Security**: No secrets in configuration files

### 3. File System Usage
- **Token Storage**: Encrypted files with secure permissions
- **Logging**: stdout/stderr only (no file logging)
- **Temporary Files**: OS temp directory for any temporary data
- **Configuration**: Read-only access to configuration files

This architecture provides a robust, secure, and performant foundation for Spotify integration through the Model Context Protocol while maintaining clean separation of concerns and comprehensive error handling.