# System Architecture

## Document Status
- **Version**: 1.0.1
- **Last Updated**: 2025-06-27
- **Owner**: Architect
- **Reviewers**: All development roles
- **Status**: ✅ Approved - Implementation Complete

## Architecture Overview

### System Purpose
The Spotify MCP Server is a Model Context Protocol-compliant server that provides standardized AI interfaces for Spotify Web API integration. It enables AI assistants like Claude to control music playback, search content, and access user data through natural language commands while maintaining enterprise-grade security and performance standards.

### Architectural Principles
1. **Protocol Compliance**: Strict adherence to MCP specification 2025-03-26 for maximum compatibility
2. **Security First**: OAuth 2.0 + PKCE authentication with encrypted token storage and comprehensive input validation
3. **Separation of Concerns**: Clear boundaries between MCP protocol handling, business logic, and external API integration
4. **Asynchronous Operations**: Non-blocking design for all I/O operations to maintain responsiveness under load

### Design Goals
- **Scalability**: Handle 100+ concurrent requests with modular architecture supporting horizontal scaling
- **Performance**: Sub-2-second response times for all operations with intelligent caching and request optimization
- **Reliability**: 99.9% uptime with graceful error handling and automatic recovery from transient failures
- **Maintainability**: Type-safe TypeScript implementation with comprehensive testing and clear code organization
- **Security**: Zero-trust architecture with defense-in-depth security controls and audit logging

## System Context

### System Boundaries
The MCP Server operates as a protocol bridge between MCP clients (AI assistants) and the Spotify Web API. The system boundary includes:
- **Inside**: MCP protocol handling, authentication management, API client wrapper, tool implementations, error handling
- **Outside**: MCP clients (Claude Desktop), Spotify Web API, OAuth authentication servers, user devices running Spotify clients

### External Dependencies
- **Spotify Web API**: Primary data source for music content, user data, and playback control
- **Spotify Accounts Service**: OAuth 2.0 authentication and token management
- **MCP Clients**: AI assistants and applications consuming the MCP interface
- **Node.js Runtime**: JavaScript execution environment with required version 18+

### Stakeholders
- **End Users**: AI assistant users requiring music control functionality through natural language
- **Developers**: Integration developers extending AI applications with music capabilities  
- **MCP Ecosystem**: Other MCP servers and clients requiring compatibility and interoperability

## High-Level Architecture

### Architectural Style
Layered Architecture with Protocol Adapter pattern - a modular monolith optimized for single-purpose MCP server deployment with clear separation between protocol, business logic, and integration layers.

### Key Architectural Patterns
- **Protocol Adapter**: MCP Server acts as adapter between MCP protocol and Spotify API, providing seamless translation
- **Repository Pattern**: Abstract data access layer for consistent API interactions and testability
- **Factory Pattern**: Dynamic tool registration and instantiation for extensible functionality
- **Strategy Pattern**: Configurable authentication and error handling strategies

### System Topology
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

Internal Architecture:
┌─────────────────────────────────────────────────────────────┐
│                     MCP Server Process                     │
├─────────────────────────────────────────────────────────────┤
│  MCP Protocol Layer    │  Tool Registry  │  Error Handler  │
├─────────────────────────────────────────────────────────────┤
│  Business Logic Layer  │  Auth Manager   │  Cache Manager  │
├─────────────────────────────────────────────────────────────┤
│  Integration Layer     │  Spotify Client │  Token Store    │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture

### MCP Protocol Layer

#### MCP Server Core
- **Technology**: @modelcontextprotocol/sdk with TypeScript runtime
- **Purpose**: Handle MCP JSON-RPC communication over stdio transport
- **Key Features**:
  - Tool registration and discovery
  - Resource management and streaming
  - Error handling and logging
  - Protocol compliance validation
- **Dependencies**: @modelcontextprotocol/sdk, Node.js streams

#### Tool Registry
- **Technology**: Factory pattern with TypeScript decorators
- **Purpose**: Dynamic registration and management of available tools
- **Interface**: Standardized tool interface with validation and metadata

### Business Logic Layer

#### Tool Implementations
- **Technology**: TypeScript classes implementing MCP tool interface
- **Architecture Pattern**: Command pattern with validation decorators
- **Key Components**:
  - **Playback Tools**: Play, pause, skip, volume, shuffle, repeat controls
  - **Search Tools**: Universal search across tracks, artists, albums, playlists
  - **Queue Tools**: Add to queue, view queue, queue management
  - **User Data Tools**: Profile access, playlists, recently played, saved content

#### Authentication Manager
- **Technology**: OAuth 2.0 + PKCE implementation with secure token storage
- **Design Pattern**: Strategy pattern for different auth flows
- **Key Responsibilities**:
  - OAuth flow orchestration
  - Token lifecycle management
  - Automatic token refresh
  - Secure credential storage

#### Cache Manager
- **Technology**: In-memory caching with TTL and size limits
- **Pattern**: Cache-aside pattern with intelligent invalidation
- **Responsibilities**:
  - API response caching
  - Token caching
  - Rate limit state management
  - Performance optimization

### Integration Layer

#### Spotify API Client
- **Type**: HTTP REST client with rate limiting and retry logic
- **Purpose**: Seamless integration with Spotify Web API v1
- **Key Features**:
  - **Request/Response Management**: Axios-based HTTP client with interceptors
  - **Rate Limiting**: 30-second rolling window compliance with request queuing
  - **Error Handling**: Exponential backoff retry with circuit breaker pattern
  - **Token Management**: Automatic OAuth token refresh and injection

#### Token Storage
- **Technology**: Encrypted file-based storage with AES-256 encryption
- **Purpose**: Secure persistence of OAuth tokens and user sessions
- **Security**: Environment-based encryption keys with secure file permissions

#### Configuration Management
- **Technology**: Environment variable-based configuration with validation
- **Purpose**: Runtime configuration without hardcoded secrets
- **Features**: Type-safe configuration loading with default values and validation

## Security Architecture

### Authentication & Authorization
- **Authentication Method**: OAuth 2.0 Authorization Code flow with PKCE (RFC 7636)
- **Authorization Pattern**: Scope-based access control aligned with Spotify API permissions
- **Token Management**: Encrypted storage with automatic refresh and rotation

### Data Security
- **Encryption at Rest**: AES-256 encryption for stored tokens and sensitive configuration
- **Encryption in Transit**: TLS 1.3 for all HTTPS communications with certificate validation
- **Data Classification**: User tokens (Confidential), API responses (Internal), Logs (Internal)

### Input Security
- **Input Validation**: Comprehensive validation using TypeScript type guards and Zod schemas
- **Sanitization**: XSS prevention and injection attack mitigation
- **Rate Limiting**: Request throttling to prevent abuse and respect API limits

### Security Monitoring
- **Audit Logging**: Structured logging of authentication events, API calls, and errors
- **Error Handling**: Secure error responses that don't leak sensitive information
- **Token Security**: Secure token lifecycle management with expiration monitoring

## Infrastructure Architecture

### Deployment Environment
- **Runtime**: Local Node.js process connecting via stdio to MCP clients
- **Container Strategy**: Docker container for consistent deployment across environments
- **Configuration**: Environment variable-based configuration with .env file support

### Scalability Strategy
- **Process Isolation**: Each MCP client connection runs independent server process
- **Memory Management**: Efficient memory usage with garbage collection optimization
- **Caching**: Intelligent caching to reduce API calls and improve response times
- **Request Queuing**: Built-in queuing for rate limit compliance

### Reliability & Recovery
- **Error Recovery**: Automatic retry with exponential backoff for transient failures
- **Token Recovery**: Automatic OAuth token refresh without user intervention
- **Graceful Degradation**: Partial functionality during API outages or network issues

## Integration Architecture

### MCP Protocol Integration
- **Protocol**: JSON-RPC 2.0 over stdio transport as per MCP specification
- **Tool Interface**: Standardized MCP tool schema with input validation and output formatting
- **Resource Streaming**: Efficient resource delivery for large datasets (playlists, search results)
- **Error Handling**: MCP-compliant error responses with detailed context

### Spotify API Integration
- **API Style**: RESTful HTTP API with JSON responses
- **Rate Limiting**: Compliance with Spotify's 30-second rolling window limits
- **Authentication**: OAuth 2.0 + PKCE flow with automatic token management
- **Error Mapping**: Translation of Spotify API errors to MCP-compatible responses

### External Service Dependencies
- **Spotify Web API**: Music data, user information, and playback control
- **Spotify Accounts Service**: OAuth authentication and token management
- **Node.js Ecosystem**: Runtime dependencies and security updates

## Performance Architecture

### Performance Requirements
- **Response Time**: Sub-2-second response for all MCP tool calls
- **Throughput**: 100+ concurrent requests per minute per server instance  
- **Memory Usage**: Maximum 256MB RAM under normal load conditions
- **Startup Time**: Server initialization completed within 5 seconds

### Performance Optimization
- **Caching Strategy**: Multi-level caching with API response cache and token cache
- **Request Optimization**: Efficient API call batching and request deduplication
- **Async Processing**: Non-blocking I/O for all network operations
- **Memory Management**: Efficient object lifecycle management and garbage collection tuning

### Monitoring & Observability
- **Application Monitoring**: Structured logging with performance metrics tracking
- **API Monitoring**: Response time tracking and error rate monitoring
- **Resource Monitoring**: Memory usage, CPU utilization, and network I/O tracking
- **Health Checks**: Built-in health endpoints for system status monitoring

## Quality Attributes

### Maintainability
- **Code Organization**: Modular TypeScript architecture with clear separation of concerns
- **Documentation**: Comprehensive JSDoc comments, README guides, and architectural documentation
- **Testing Strategy**: Multi-layer testing with unit tests, integration tests, and MCP protocol compliance tests

### Reliability
- **Error Handling**: Comprehensive error handling with typed error responses and logging
- **Retry Logic**: Exponential backoff retry patterns for transient failures
- **Graceful Degradation**: Partial functionality during API outages with clear user feedback

### Developer Experience
- **Type Safety**: Full TypeScript coverage with strict type checking
- **Development Tools**: Hot reload, debugging support, and comprehensive logging
- **Configuration**: Simple environment-based setup with clear documentation

## Technical Debt and Evolution

### Initial Technical Considerations
- **Initial Implementation**: Single stdio transport - HTTP/SSE transport to be added in future versions
- **Token Storage**: File-based storage suitable for single-user scenarios - database storage for multi-user deployments

### Planned Improvements
- **HTTP Transport**: Add HTTP/SSE transport support for remote MCP server deployment (Q2 2025)
- **Enhanced Caching**: Implement Redis-based caching for distributed deployments (Q3 2025)
- **Webhook Support**: Real-time playback state updates via Spotify webhooks (Q4 2025)

### Implemented Features (v1.0.1)
- ✅ **Enterprise Security**: HSM support and certificate management implemented
- ✅ **User Insights**: 6 additional analytics tools with 100% test coverage
- ✅ **DXT Package**: Desktop extension support for easy installation
- ✅ **Production Hardening**: Security audit completion and production deployment

### Technology Evolution
- **Framework Updates**: Quarterly updates to MCP SDK and security patches
- **API Versioning**: Forward compatibility planning for Spotify API changes
- **Performance Optimization**: Continuous performance monitoring and optimization

## Decision Records

### ADR-001: TypeScript as Primary Language
- **Date**: 2025-06-25
- **Status**: Accepted
- **Context**: Need to choose implementation language for MCP server with requirements for type safety, ecosystem support, and developer productivity
- **Decision**: Use TypeScript with Node.js runtime for implementation
- **Consequences**: 
  - **Positive**: Excellent MCP SDK support, strong typing, rich ecosystem, familiar to developers
  - **Negative**: Runtime overhead compared to compiled languages, requires build step

### ADR-002: stdio Transport for Initial Version
- **Date**: 2025-06-25
- **Status**: Accepted
- **Context**: MCP supports both stdio and HTTP transports; need to prioritize for initial implementation
- **Decision**: Implement stdio transport first, HTTP/SSE transport in future version
- **Consequences**:
  - **Positive**: Simpler implementation, direct integration with Claude Desktop, faster time to market
  - **Negative**: Limited to local deployment scenarios, requires separate process per client

## Compliance and Governance

### Protocol Compliance
- **MCP Specification**: Full compliance with Model Context Protocol specification 2025-03-26
- **OAuth 2.1**: Adherence to OAuth 2.1 security framework with PKCE implementation

### Architecture Governance
- **Review Process**: Multi-persona architectural reviews with Architect, Security Engineer, and Backend Developer approval
- **Standards Compliance**: TypeScript strict mode, ESLint rules, security scanning, and automated testing requirements
- **Change Management**: Architectural changes require ADR documentation and impact assessment

---

*This architecture document serves as the technical blueprint for system implementation and evolution. Regular reviews ensure alignment with changing requirements and technology landscape.*