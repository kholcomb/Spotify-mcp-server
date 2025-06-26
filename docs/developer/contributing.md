# Contributing to Spotify MCP Server

Thank you for your interest in contributing to the Spotify MCP Server! This guide will help you get started with development and ensure your contributions align with project standards.

## Development Setup

### Prerequisites
- **Node.js 18.0+** (LTS recommended)
- **npm 9.0+** (comes with Node.js)
- **Git** for version control
- **Spotify Developer Account** for testing

### Initial Setup

1. **Clone and install dependencies:**
   ```bash
   git clone [repository-url]
   cd spotify-mcp-server
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your Spotify developer credentials
   ```

3. **Verify setup:**
   ```bash
   npm run typecheck  # Should pass without errors
   npm run lint       # Should pass without errors
   npm run test       # Should pass (when tests exist)
   ```

## Development Workflow

### Code Quality Standards

We maintain high code quality through automated tooling:

#### TypeScript Configuration
- **Strict mode enabled** - All code must pass strict type checking
- **No `any` types** - Use proper typing or `unknown` with type guards
- **Explicit return types** - All public functions must declare return types

#### ESLint Rules
```bash
npm run lint        # Check for style and error issues
npm run lint:fix    # Auto-fix issues where possible
```

Key rules enforced:
- No unused variables (except prefixed with `_`)
- Explicit function return types for public APIs
- Prefer nullish coalescing and optional chaining
- No console.log in production code (use logger)

#### Code Formatting
```bash
npm run format      # Format all TypeScript files
```

Configuration:
- 2-space indentation
- Single quotes for strings
- Semicolons required
- Trailing commas for multi-line structures

### Git Workflow

#### Branch Naming
Use descriptive branch names with prefixes:
```bash
feat/oauth-pkce-implementation
fix/rate-limit-handling
docs/api-documentation-update
refactor/spotify-client-error-handling
test/integration-test-suite
```

#### Commit Message Format
We use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `security`: Security improvements

**Scopes:**
- `auth`: Authentication system
- `spotify`: Spotify API integration
- `tools`: MCP tool implementations
- `server`: MCP server core
- `types`: Type definitions
- `tests`: Test infrastructure

**Examples:**
```bash
feat(auth): implement PKCE flow for OAuth 2.0
fix(spotify): handle rate limit errors gracefully
docs(api): add comprehensive tool documentation
test(tools): add unit tests for playback controls
```

### Code Organization

#### File Structure
Follow the established project structure:
```
src/
├── server/        # MCP server implementation
├── tools/         # Individual tool implementations
├── auth/          # Authentication and token management
├── spotify/       # Spotify API client and models
├── types/         # TypeScript type definitions
├── utils/         # Shared utilities
└── index.ts       # Main entry point
```

#### Naming Conventions
- **Files**: camelCase (`spotifyClient.ts`, `authManager.ts`)
- **Classes**: PascalCase (`SpotifyClient`, `AuthManager`)
- **Functions**: camelCase (`getCurrentPlayback`, `refreshToken`)
- **Constants**: UPPER_SNAKE_CASE (`SPOTIFY_API_BASE_URL`)
- **Interfaces/Types**: PascalCase with descriptive suffixes (`SpotifyTrack`, `AuthConfig`)

#### Import Organization
```typescript
// 1. Node.js built-in modules
import { readFileSync } from 'fs';
import { createHash } from 'crypto';

// 2. External dependencies
import axios from 'axios';
import { z } from 'zod';

// 3. Internal imports (use path aliases)
import { logger } from '@/utils/logger.js';
import type { SpotifyTrack } from '@/types/index.js';
```

## Implementation Guidelines

### Adding New Tools

When implementing new MCP tools:

1. **Create tool class implementing `MCPTool` interface:**
   ```typescript
   import { z } from 'zod';
   import type { MCPTool, ToolContext, ToolResult } from '@/types/index.js';

   export class NewTool implements MCPTool {
     name = 'new_tool';
     description = 'Description of what this tool does';
     
     inputSchema = z.object({
       param1: z.string().describe('Description of parameter'),
       param2: z.number().optional().describe('Optional parameter'),
     });
     
     async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
       // Validate input
       const params = this.inputSchema.parse(input);
       
       // Implement tool logic
       const result = await context.spotify.someApiCall(params);
       
       // Return formatted result
       return {
         success: true,
         data: result,
       };
     }
   }
   ```

2. **Add comprehensive JSDoc documentation:**
   ```typescript
   /**
    * Tool for managing Spotify playback queue
    * 
    * @example
    * ```typescript
    * const tool = new QueueTool();
    * const result = await tool.handler({ uri: 'spotify:track:...' }, context);
    * ```
    */
   export class QueueTool implements MCPTool {
     // ...
   }
   ```

3. **Register tool in server configuration**

4. **Add corresponding tests**

### Error Handling

#### Error Classification
All errors should be properly classified and handled:

```typescript
import { SpotifyAPIError, ValidationError, AuthError } from '@/types/errors.js';

try {
  const result = await spotifyClient.apiCall('/me/player/play');
  return { success: true, data: result };
} catch (error) {
  if (error instanceof SpotifyAPIError) {
    if (error.status === 401) {
      // Token expired - trigger refresh
      throw new AuthError('Authentication required', { retryable: true });
    } else if (error.status === 429) {
      // Rate limited - queue request
      throw new RateLimitError('Rate limit exceeded', { retryAfter: error.retryAfter });
    }
  }
  throw error; // Re-throw unknown errors
}
```

#### Error Response Format
Always return consistent error responses:
```typescript
return {
  success: false,
  error: {
    code: 'SPOTIFY_API_ERROR',
    message: 'User-friendly error message',
    retryable: true,
    details: {
      spotifyError: originalError.response?.data,
    },
  },
};
```

### Testing

#### Unit Tests
Write unit tests for all new functionality:

```typescript
// tools/playback.test.ts
import { PlayTool } from './playback.js';
import { createMockContext } from '../test-utils/mocks.js';

describe('PlayTool', () => {
  let tool: PlayTool;
  let mockContext: MockToolContext;

  beforeEach(() => {
    tool = new PlayTool();
    mockContext = createMockContext();
  });

  it('should start playback successfully', async () => {
    mockContext.spotify.startPlayback.mockResolvedValue({ device: 'Test Device' });
    
    const result = await tool.handler({}, mockContext);
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ device: 'Test Device' });
  });

  it('should handle invalid input', async () => {
    await expect(tool.handler({ invalid: true }, mockContext))
      .rejects.toThrow('Validation error');
  });
});
```

#### Integration Tests
Test integration points with mocked Spotify API:

```typescript
// integration/spotify-client.test.ts
import { SpotifyClient } from '@/spotify/client.js';
import { mockSpotifyAPI } from '../test-utils/spotify-mock.js';

describe('SpotifyClient Integration', () => {
  beforeEach(() => {
    mockSpotifyAPI.reset();
  });

  it('should handle rate limiting gracefully', async () => {
    mockSpotifyAPI.rateLimitNext();
    
    const client = new SpotifyClient(testConfig);
    const result = await client.getCurrentPlayback();
    
    expect(result).toBeDefined();
    expect(mockSpotifyAPI.getRequestCount()).toBe(2); // Original + retry
  });
});
```

#### Test Coverage
Maintain high test coverage:
```bash
npm run test:coverage  # Should show 80%+ coverage
```

Focus on:
- All public API methods
- Error handling paths
- Edge cases and boundary conditions
- Integration points

### Documentation

#### Code Documentation
- **All public classes and methods** must have JSDoc comments
- **Complex logic** should include inline comments
- **Type definitions** should include descriptions

#### API Documentation
Update API documentation when adding new tools:
- Add tool to `docs/api/README.md`
- Include input schema, response format, and examples
- Document error conditions and requirements

#### User Documentation
Update user guides for new features:
- Add usage examples to `docs/user/user-guide.md`
- Update setup instructions if needed
- Include troubleshooting information

## Pull Request Process

### Before Submitting

1. **Code Quality Checks:**
   ```bash
   npm run typecheck  # TypeScript compilation
   npm run lint       # Style and error checking
   npm run test       # Test suite
   npm run build      # Production build
   ```

2. **Documentation Updates:**
   - Update API documentation for new tools
   - Update user guide for user-facing changes
   - Update this contributing guide for process changes

3. **Commit Organization:**
   - Squash related commits into logical units
   - Write clear commit messages following conventional format
   - Ensure each commit passes all checks

### Pull Request Template

Use this template for pull requests:

```markdown
## Description
Brief description of changes made.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Test coverage maintained/improved

## Documentation
- [ ] Code comments updated
- [ ] API documentation updated
- [ ] User documentation updated
- [ ] README updated if needed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] No hardcoded secrets or credentials
- [ ] Error handling implemented
- [ ] Performance impact considered
```

### Review Process

1. **Automated Checks:** All CI checks must pass
2. **Code Review:** At least one team member review required
3. **Testing:** Manual testing for user-facing changes
4. **Documentation:** Review of updated documentation

## Release Process

### Version Numbering
We follow [Semantic Versioning](https://semver.org/):
- **Major** (1.0.0): Breaking changes
- **Minor** (0.1.0): New features, backward compatible
- **Patch** (0.0.1): Bug fixes, backward compatible

### Release Checklist
1. Update version in `package.json`
2. Update `CHANGELOG.md` with release notes
3. Tag release with `git tag v1.0.0`
4. Create GitHub release with notes
5. Update documentation for any new features

## Getting Help

### Development Questions
- Check existing issues and documentation first
- Create issue with `question` label for development questions
- Join discussions for design decisions

### Bug Reports
When reporting bugs, include:
- Node.js and npm versions
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs or error messages

### Feature Requests
For new features:
- Check if similar feature exists or is planned
- Describe use case and benefit
- Consider implementation complexity
- Discuss in issue before implementing

## Code of Conduct

### Standards
- Use welcoming and inclusive language
- Be respectful of differing viewpoints
- Focus on what is best for the community
- Show empathy towards other community members

### Responsibilities
- Report any unacceptable behavior
- Maintain professional standards in all interactions
- Help create a positive environment for all contributors

Thank you for contributing to the Spotify MCP Server! Your efforts help make music control through AI assistants better for everyone.