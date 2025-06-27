# Spotify MCP Server Constraints and Standards

## Document Status
- **Version**: 1.0.1
- **Last Updated**: 2025-06-27
- **Owner**: Architect
- **Reviewers**: All technical roles
- **Status**: ✅ Implemented - All constraints successfully applied

## Overview

This document outlines the technical constraints, standards, and guidelines specific to the Spotify MCP Server project. These constraints ensure consistency, quality, security, and maintainability while working within Spotify API limitations and MCP protocol requirements.

## Technology Stack Constraints

### Required Technologies

#### Core Framework
- **Runtime**: Node.js 18.0+ (LTS versions only)
- **Language**: TypeScript 5.3+ with strict mode enabled
- **MCP SDK**: @modelcontextprotocol/sdk ^1.0.0 (official SDK only)
- **Build Tool**: TypeScript compiler (tsc) - no additional bundlers required

#### HTTP and Networking
- **HTTP Client**: Axios ^1.6.0 for Spotify API calls
- **Protocol**: MCP JSON-RPC 2.0 over stdio transport
- **Security**: TLS 1.3 for all external communications

#### Development and Testing
- **Testing Framework**: Jest ^29.7.0
- **Code Quality**: ESLint + Prettier with TypeScript rules
- **Type Checking**: TypeScript strict mode with no implicit any

### Prohibited Technologies
- **Alternative MCP Libraries**: Only official @modelcontextprotocol/sdk allowed
- **HTTP Frameworks**: No Express.js, Fastify, or other HTTP servers (stdio only)
- **Database Systems**: No persistent databases - file-based token storage only
- **UI Frameworks**: This is a server-only application - no UI frameworks

### Spotify API Constraints
- **API Version**: Spotify Web API v1 only
- **Authentication**: OAuth 2.0 + PKCE (Authorization Code flow) - no client credentials flow
- **Rate Limiting**: Must respect 30-second rolling window limits
- **Premium Requirement**: Playback control requires Spotify Premium subscription

## Coding Standards

### TypeScript-Specific Standards
- **Style Guide**: Airbnb TypeScript config with project-specific overrides
- **Linting**: ESLint with @typescript-eslint/recommended and prettier integration
- **Formatting**: Prettier with 2-space indentation, semicolons, single quotes
- **Type Safety**: TypeScript strict mode, no `any` types, explicit return types for public methods
- **File Naming**: camelCase for files and directories, PascalCase for classes

#### Required ESLint Configuration
```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "@typescript-eslint/recommended-requiring-type-checking",
    "prettier"
  ],
  "rules": {
    "no-console": "warn",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/prefer-readonly": "error",
    "prefer-const": "error"
  }
}
```

#### Prettier Configuration
```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false
}
```

### Code Organization

#### Required Project Structure
```
project/
├── src/
│   ├── server/        # MCP server core implementation
│   ├── tools/         # MCP tool implementations
│   ├── auth/          # Authentication and OAuth handling
│   ├── spotify/       # Spotify API client and models
│   ├── types/         # TypeScript type definitions
│   ├── utils/         # Utility functions and helpers
│   └── index.ts       # Main entry point
├── tests/
│   ├── unit/          # Unit tests for individual components
│   ├── integration/   # Integration tests with Spotify API
│   └── fixtures/      # Test data and mocks
├── docs/              # API documentation and guides
└── config/            # Configuration and environment files
```

#### Naming Conventions
- **Files**: camelCase (e.g., `spotifyClient.ts`, `authManager.ts`)
- **Functions**: camelCase (e.g., `getCurrentPlayback`, `refreshAccessToken`)
- **Variables**: camelCase (e.g., `accessToken`, `playbackState`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `SPOTIFY_API_BASE_URL`, `TOKEN_EXPIRY_BUFFER`)
- **Classes**: PascalCase (e.g., `SpotifyClient`, `AuthenticationManager`)
- **Interfaces/Types**: PascalCase with descriptive suffixes (e.g., `SpotifyTrack`, `PlaybackRequest`, `AuthenticationConfig`)

## Quality Standards

### Code Quality Metrics

#### Test Coverage Requirements
- **Minimum Coverage**: 80% line coverage for all new code
- **Critical Path Coverage**: 95% for authentication and API integration logic
- **Required Test Types**:
  - Unit tests: All tool implementations, auth logic, utility functions
  - Integration tests: Spotify API interactions, MCP protocol compliance
  - End-to-end tests: Complete user workflows through MCP client

#### Code Complexity Limits
- **Cyclomatic Complexity**: Maximum 8 per function
- **Function Length**: Maximum 40 lines (excluding comments and type definitions)
- **File Length**: Maximum 250 lines
- **Nesting Depth**: Maximum 3 levels

#### Documentation Requirements
- **JSDoc Comments**: All public classes, methods, and complex functions
- **Type Documentation**: All custom types and interfaces documented
- **README Updates**: Update project README for any new features
- **Error Documentation**: Document all error scenarios and recovery

### Performance Standards

#### MCP Server Performance
- **Tool Response Time**: < 2 seconds for all MCP tool calls
- **Startup Time**: < 5 seconds from process start to ready state
- **Memory Usage**: < 256MB RAM under normal load (100 requests/hour)
- **Spotify API Efficiency**: Minimize API calls through intelligent caching

#### Rate Limiting Compliance
- **Spotify API Limits**: Never exceed 30-second rolling window limits
- **Request Queuing**: Implement request queue for rate limit compliance
- **Retry Logic**: Exponential backoff with maximum 3 retry attempts
- **Cache Usage**: Cache responses for minimum 5 minutes where appropriate

## Security Standards

### OAuth 2.0 + PKCE Requirements
- **Flow Type**: Authorization Code with PKCE (RFC 7636) - MANDATORY
- **Code Verifier**: Minimum 43 characters, cryptographically random
- **State Parameter**: Required for CSRF protection, minimum 32 characters
- **Redirect URI**: Must be HTTPS (except localhost for development)
- **Token Storage**: AES-256 encrypted file storage with secure file permissions

### Data Protection Standards
- **Encryption at Rest**: AES-256 encryption for all stored tokens and sensitive data
- **Encryption in Transit**: TLS 1.3 for all HTTPS communications
- **Token Security**: Never log access tokens or refresh tokens
- **Secrets Management**: Environment variables only, no hardcoded credentials
- **Data Retention**: Tokens expired after 24 hours of inactivity, configurable

### Input Validation Requirements
- **MCP Input Validation**: All MCP tool inputs validated using Zod schemas
- **Spotify API Parameters**: Validate all parameters before API calls
- **Type Safety**: Use TypeScript type guards for runtime validation
- **Error Handling**: Never expose internal errors or tokens in responses

### Security Monitoring
- **Authentication Events**: Log all authentication attempts and token refresh operations
- **API Usage**: Monitor Spotify API usage patterns for anomalies
- **Error Tracking**: Secure error logging without sensitive data exposure
- **Security Scanning**: npm audit on every build, dependency vulnerability monitoring

## MCP Protocol Standards

### Tool Implementation Requirements
- **Tool Registration**: All tools must implement proper MCP tool schema
- **Input Validation**: Use Zod schemas for all tool input validation
- **Output Format**: Consistent, structured responses for all tools
- **Error Handling**: Proper MCP error responses with meaningful messages

#### Required Tool Structure
```typescript
interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  handler: (input: unknown) => Promise<MCPToolResult>;
}
```

### Resource Management Standards
- **Resource URIs**: Use consistent URI patterns for Spotify resources
- **Caching Strategy**: Cache resources for 5+ minutes to reduce API calls
- **Streaming**: Use streaming for large datasets (playlists, search results)
- **Error Recovery**: Graceful degradation when resources unavailable

### Spotify API Integration Standards

#### Request Patterns
- **Base URL**: Always use https://api.spotify.com/v1/
- **Headers**: Include proper User-Agent and Accept headers
- **Authentication**: Bearer token in Authorization header
- **Content-Type**: application/json for POST/PUT requests

#### Response Handling
- **Error Mapping**: Map Spotify API errors to appropriate MCP errors
- **Rate Limit Handling**: Respect 429 responses with proper backoff
- **Token Refresh**: Automatic token refresh on 401 responses
- **Retry Logic**: Exponential backoff for 5xx errors, maximum 3 retries

## Environment and Deployment Standards

### Environment Management
- **Local Development**: Node.js 18+ with TypeScript and hot reload
- **Testing Environment**: Isolated Spotify test application with limited scopes
- **Production**: Same Node.js version, optimized build, secure token storage
- **Configuration**: Environment variables for all configuration, .env file support

### Process Management
- **Single Process**: MCP server runs as single Node.js process
- **Graceful Shutdown**: Handle SIGTERM and SIGINT signals properly
- **Health Monitoring**: Built-in health check accessible via MCP tools
- **Error Recovery**: Automatic restart on uncaught exceptions

### File System Requirements
- **Token Storage**: Secure directory with appropriate file permissions (600)
- **Log Files**: Structured logging to stdout/stderr (no file logging)
- **Configuration**: Read-only access to configuration files
- **Temporary Files**: Use OS temporary directory for any temporary data

## Compliance Requirements

### MCP Protocol Compliance
- **Specification Version**: Must comply with MCP specification 2025-03-26
- **Transport Protocol**: stdio transport implementation required
- **Message Format**: JSON-RPC 2.0 compliance mandatory
- **Error Responses**: Standard MCP error format for all failures

### Spotify API Compliance
- **Developer Terms**: Full compliance with Spotify Developer Terms of Service
- **Rate Limits**: Strict adherence to API rate limiting requirements
- **Data Usage**: Only use data as permitted by Spotify's terms
- **Attribution**: Proper attribution when displaying Spotify content

### Security Compliance
- **OAuth 2.1**: Compliance with OAuth 2.1 security recommendations
- **PKCE**: Mandatory implementation of Proof Key for Code Exchange
- **Token Security**: Secure token storage and handling practices
- **Audit Trail**: Comprehensive logging of all security events

## Monitoring and Observability

### Logging Standards
- **Log Levels**: DEBUG, INFO, WARN, ERROR (no FATAL - process should restart)
- **Log Format**: Structured JSON logging to stdout/stderr
- **Security**: Never log tokens, secrets, or personally identifiable information
- **Context**: Include request IDs and user context for tracing

#### Required Log Structure
```json
{
  "timestamp": "2025-06-25T12:00:00Z",
  "level": "INFO",
  "component": "spotify-client",
  "operation": "getCurrentPlayback",
  "message": "Retrieved current playback state",
  "duration_ms": 150,
  "user_id": "spotify:user:123" // anonymized
}
```

### Performance Monitoring
- **Response Times**: Track all MCP tool response times
- **API Calls**: Monitor Spotify API call frequency and response times
- **Error Rates**: Track error rates by type and component
- **Memory Usage**: Monitor memory consumption and garbage collection

## Development Workflow Standards

### Git Workflow Requirements
- **Branching Strategy**: GitHub Flow with feature branches
- **Commit Messages**: Conventional Commits format (required)
- **Pull Request Process**: All changes require peer review and CI passes
- **Branch Protection**: main branch protected, requires PR and status checks

#### Mandatory Commit Message Format
```
type(scope): description

[optional body]

[optional footer with breaking changes]
```

**Required Types**: feat, fix, docs, style, refactor, test, chore, security
**Scopes**: auth, spotify, tools, server, types, tests

### Code Review Requirements
- **Approval Requirements**: Minimum 1 approval from project team member
- **Required Checks**: All CI checks must pass (lint, test, typecheck)
- **Review Focus**: Security, performance, MCP compliance, Spotify API usage
- **Timeline**: Reviews completed within 24 hours for critical fixes

### Continuous Integration
- **Build Verification**: TypeScript compilation must succeed
- **Code Quality**: ESLint and Prettier checks must pass
- **Test Suite**: All tests must pass with 80%+ coverage
- **Security Scan**: npm audit must show no high/critical vulnerabilities

## Error Handling Standards

### Error Classification
- **Authentication Errors**: Token expired, invalid credentials, OAuth failures
- **API Errors**: Spotify API errors, rate limiting, network failures
- **Validation Errors**: Invalid input parameters, schema validation failures
- **System Errors**: File system errors, memory issues, process failures

### Error Response Format
```typescript
interface MCPError {
  code: number;          // MCP error code
  message: string;       // User-friendly message
  data?: {
    spotifyError?: any;  // Original Spotify API error
    retryable: boolean;  // Whether operation can be retried
  };
}
```

### Recovery Strategies
- **Token Refresh**: Automatic retry with token refresh for auth errors
- **Rate Limiting**: Queue requests and retry after rate limit reset
- **Network Errors**: Exponential backoff retry up to 3 attempts
- **Graceful Degradation**: Partial functionality when possible

---

*These constraints ensure secure, reliable, and maintainable integration with Spotify services while providing excellent user experience through MCP protocol compliance.*