# Testing Guide

This document covers the testing strategy, setup, and best practices for the Spotify MCP Server project.

## Testing Strategy

### Testing Pyramid

```
                    ┌─────────────────┐
                    │   E2E Tests     │ ← Full MCP workflow tests
                    │   (Few, High)   │
                    └─────────────────┘
                  ┌─────────────────────┐
                  │  Integration Tests  │ ← API integration tests
                  │  (Some, Medium)     │
                  └─────────────────────┘
                ┌─────────────────────────┐
                │     Unit Tests          │ ← Component/function tests
                │   (Many, Fast, Low)     │
                └─────────────────────────┘
```

### Test Categories

#### 1. Unit Tests (Primary Focus)
- **Purpose**: Test individual functions, classes, and components in isolation
- **Scope**: ~80% of total tests
- **Speed**: Very fast (<100ms per test)
- **Coverage**: All public APIs, error paths, edge cases

#### 2. Integration Tests
- **Purpose**: Test integration between components and external services
- **Scope**: ~15% of total tests
- **Speed**: Medium (100ms-1s per test)
- **Coverage**: Spotify API client, authentication flow, MCP protocol

#### 3. End-to-End Tests
- **Purpose**: Test complete user workflows through MCP interface
- **Scope**: ~5% of total tests
- **Speed**: Slower (1s+ per test)
- **Coverage**: Critical user paths, tool chains

## Test Setup

### Prerequisites

```bash
npm install  # Install all dependencies including test framework
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- auth/authManager.test.ts

# Run tests matching pattern
npm test -- --grep "authentication"
```

### Test Configuration

Jest configuration in `package.json`:
```json
{
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "collectCoverageFrom": [
      "src/**/*.ts",
      "!src/**/*.d.ts",
      "!src/**/*.test.ts"
    ],
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

## Unit Testing

### Test Structure

Follow the AAA pattern (Arrange, Act, Assert):

```typescript
// tools/playback.test.ts
import { PlayTool } from './playback.js';
import { createMockContext } from '../test-utils/mocks.js';

describe('PlayTool', () => {
  let tool: PlayTool;
  let mockContext: MockToolContext;

  beforeEach(() => {
    // Arrange - Set up test environment
    tool = new PlayTool();
    mockContext = createMockContext();
  });

  describe('handler', () => {
    it('should start playback with valid input', async () => {
      // Arrange
      const input = { device_id: 'test-device' };
      mockContext.spotify.startPlayback.mockResolvedValue({
        device: { name: 'Test Device' }
      });

      // Act
      const result = await tool.handler(input, mockContext);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.device.name).toBe('Test Device');
      expect(mockContext.spotify.startPlayback).toHaveBeenCalledWith(input);
    });

    it('should handle validation errors', async () => {
      // Arrange
      const invalidInput = { invalid_field: 'test' };

      // Act & Assert
      await expect(tool.handler(invalidInput, mockContext))
        .rejects.toThrow('Validation error');
    });
  });
});
```

### Mock Utilities

Create reusable mock utilities in `tests/fixtures/`:

```typescript
// tests/fixtures/mocks.ts
export interface MockSpotifyClient {
  startPlayback: jest.MockedFunction<any>;
  pausePlayback: jest.MockedFunction<any>;
  getCurrentPlayback: jest.MockedFunction<any>;
  search: jest.MockedFunction<any>;
}

export interface MockToolContext {
  spotify: MockSpotifyClient;
  auth: MockAuthManager;
  logger: MockLogger;
}

export function createMockContext(): MockToolContext {
  return {
    spotify: {
      startPlayback: jest.fn(),
      pausePlayback: jest.fn(),
      getCurrentPlayback: jest.fn(),
      search: jest.fn(),
    },
    auth: {
      getValidToken: jest.fn(),
      refreshToken: jest.fn(),
    },
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
  };
}
```

### Testing Error Handling

Test all error scenarios:

```typescript
describe('error handling', () => {
  it('should handle Spotify API errors', async () => {
    // Arrange
    const spotifyError = {
      status: 401,
      message: 'The access token expired'
    };
    mockContext.spotify.startPlayback.mockRejectedValue(
      new SpotifyAPIError('Token expired', spotifyError)
    );

    // Act
    const result = await tool.handler({}, mockContext);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('AUTHENTICATION_ERROR');
    expect(result.error.retryable).toBe(true);
  });

  it('should handle rate limiting', async () => {
    // Test rate limit error handling
    const rateLimitError = new RateLimitError('Rate limit exceeded', {
      retryAfter: 30
    });
    
    mockContext.spotify.startPlayback.mockRejectedValue(rateLimitError);

    const result = await tool.handler({}, mockContext);

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('RATE_LIMIT_ERROR');
  });
});
```

### Testing Async Code

Handle async operations properly:

```typescript
describe('async operations', () => {
  it('should handle concurrent requests', async () => {
    // Arrange
    const requests = Array.from({ length: 5 }, (_, i) => ({
      device_id: `device-${i}`
    }));

    mockContext.spotify.startPlayback.mockImplementation(
      (input) => Promise.resolve({ device: { name: input.device_id } })
    );

    // Act
    const results = await Promise.all(
      requests.map(req => tool.handler(req, mockContext))
    );

    // Assert
    expect(results).toHaveLength(5);
    results.forEach((result, index) => {
      expect(result.success).toBe(true);
      expect(result.data.device.name).toBe(`device-${index}`);
    });
  });
});
```

## Integration Testing

### Spotify API Integration

Test real API behavior with mocked responses:

```typescript
// tests/integration/spotify-client.test.ts
import { SpotifyClient } from '@/spotify/client.js';
import { setupSpotifyMock } from '../fixtures/spotify-mock.js';

describe('SpotifyClient Integration', () => {
  let client: SpotifyClient;
  let mockAPI: SpotifyMockAPI;

  beforeEach(() => {
    mockAPI = setupSpotifyMock();
    client = new SpotifyClient({
      baseURL: mockAPI.baseURL,
      timeout: 5000,
    });
  });

  afterEach(() => {
    mockAPI.reset();
  });

  describe('rate limiting', () => {
    it('should handle 429 responses with retry', async () => {
      // Arrange
      mockAPI.mockEndpoint('/me/player', {
        status: 429,
        headers: { 'retry-after': '1' },
        delay: 100,
      });
      
      mockAPI.mockEndpoint('/me/player', {
        status: 200,
        body: { is_playing: true },
        delay: 50,
      });

      // Act
      const start = Date.now();
      const result = await client.getCurrentPlayback();
      const duration = Date.now() - start;

      // Assert
      expect(result).toBeDefined();
      expect(result.is_playing).toBe(true);
      expect(duration).toBeGreaterThan(1000); // Waited for retry-after
      expect(mockAPI.getRequestCount('/me/player')).toBe(2);
    });
  });

  describe('authentication', () => {
    it('should refresh token on 401 response', async () => {
      // Test automatic token refresh
      mockAPI.mockEndpoint('/me/player', { status: 401 });
      mockAPI.mockEndpoint('/api/token', {
        status: 200,
        body: { access_token: 'new-token', expires_in: 3600 }
      });
      mockAPI.mockEndpoint('/me/player', {
        status: 200,
        body: { is_playing: false }
      });

      const result = await client.getCurrentPlayback();

      expect(result.is_playing).toBe(false);
      expect(mockAPI.getRequestCount('/api/token')).toBe(1);
    });
  });
});
```

### MCP Protocol Integration

Test MCP protocol compliance:

```typescript
// tests/integration/mcp-protocol.test.ts
import { MCPServer } from '@/server/mcpServer.js';
import { createMockMCPClient } from '../fixtures/mcp-mock.js';

describe('MCP Protocol Integration', () => {
  let server: MCPServer;
  let mockClient: MockMCPClient;

  beforeEach(async () => {
    server = new MCPServer();
    mockClient = createMockMCPClient();
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('tool discovery', () => {
    it('should return all available tools', async () => {
      // Act
      const response = await mockClient.request({
        method: 'tools/list',
        params: {}
      });

      // Assert
      expect(response.result.tools).toContainEqual(
        expect.objectContaining({
          name: 'play',
          description: expect.stringContaining('playback')
        })
      );
    });
  });

  describe('tool execution', () => {
    it('should execute play tool successfully', async () => {
      // Arrange
      const request = {
        method: 'tools/call',
        params: {
          name: 'play',
          arguments: { device_id: 'test-device' }
        }
      };

      // Act
      const response = await mockClient.request(request);

      // Assert
      expect(response.result.isError).toBe(false);
      expect(response.result.content).toContainEqual(
        expect.objectContaining({
          type: 'text',
          text: expect.stringContaining('playback started')
        })
      );
    });
  });
});
```

## End-to-End Testing

### User Workflow Tests

Test complete user scenarios:

```typescript
// tests/e2e/user-workflows.test.ts
import { E2ETestHarness } from '../fixtures/e2e-harness.js';

describe('User Workflows', () => {
  let harness: E2ETestHarness;

  beforeEach(async () => {
    harness = new E2ETestHarness();
    await harness.setup();
  });

  afterEach(async () => {
    await harness.cleanup();
  });

  describe('music control workflow', () => {
    it('should complete full playback control flow', async () => {
      // 1. Authenticate
      await harness.authenticate();

      // 2. Search for music
      const searchResult = await harness.executeTool('search', {
        query: 'The Beatles',
        type: ['track']
      });
      expect(searchResult.success).toBe(true);

      // 3. Start playback
      const playResult = await harness.executeTool('play', {
        uris: [searchResult.data.tracks.items[0].uri]
      });
      expect(playResult.success).toBe(true);

      // 4. Check current playback
      const statusResult = await harness.executeTool('get_current_playback');
      expect(statusResult.data.is_playing).toBe(true);

      // 5. Pause playback
      const pauseResult = await harness.executeTool('pause');
      expect(pauseResult.success).toBe(true);
    });
  });
});
```

## Test Data and Fixtures

### Mock Data

Create realistic test data:

```typescript
// tests/fixtures/spotify-data.ts
export const mockTrack: SpotifyTrack = {
  id: '4iV5W9uYEdYUVa79Axb7Rh',
  name: 'Yesterday',
  artists: [{
    id: '3WrFJ7ztbogyGnTHbHJFl2',
    name: 'The Beatles'
  }],
  album: {
    id: '1J588G2nyAIjvFeubHnh6O',
    name: 'Help!',
    images: [{
      url: 'https://example.com/image.jpg',
      height: 300,
      width: 300
    }]
  },
  duration_ms: 125000,
  external_urls: {
    spotify: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh'
  },
  preview_url: 'https://example.com/preview.mp3'
};

export const mockPlaybackState: PlaybackState = {
  is_playing: true,
  progress_ms: 45000,
  item: mockTrack,
  device: {
    id: 'device-123',
    name: 'Test Device',
    type: 'Computer',
    volume_percent: 75
  },
  shuffle_state: false,
  repeat_state: 'off'
};
```

### Environment Setup

Manage test environment:

```typescript
// tests/setup.ts
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test-specific environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce noise in tests

// Global test setup
beforeAll(() => {
  // Setup global test resources
});

afterAll(() => {
  // Cleanup global test resources
});
```

## Performance Testing

### Load Testing

Test concurrent request handling:

```typescript
// tests/performance/load.test.ts
describe('Load Testing', () => {
  it('should handle concurrent requests', async () => {
    const concurrentRequests = 50;
    const requests = Array.from({ length: concurrentRequests }, () =>
      tool.handler({ query: 'test' }, mockContext)
    );

    const start = Date.now();
    const results = await Promise.all(requests);
    const duration = Date.now() - start;

    // All requests should succeed
    expect(results.every(r => r.success)).toBe(true);
    
    // Should complete within reasonable time
    expect(duration).toBeLessThan(5000);
    
    // Should respect rate limits
    expect(mockContext.rateLimiter.wasThrottled).toBe(true);
  });
});
```

### Memory Testing

Monitor memory usage:

```typescript
describe('Memory Usage', () => {
  it('should not leak memory during extended use', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Simulate extended usage
    for (let i = 0; i < 1000; i++) {
      await tool.handler({ query: `test-${i}` }, mockContext);
      
      // Force garbage collection every 100 requests
      if (i % 100 === 0 && global.gc) {
        global.gc();
      }
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    // Memory increase should be reasonable
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
  });
});
```

## Test Debugging

### Debug Configuration

VS Code debug configuration (`.vscode/launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Jest Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": [
        "--runInBand",
        "--no-cache",
        "${relativeFile}"
      ],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "env": {
        "NODE_ENV": "test"
      }
    }
  ]
}
```

### Debugging Tips

1. **Use `fit` and `fdescribe`** to focus on specific tests
2. **Add `console.log`** statements for debugging (remove before commit)
3. **Use Jest's `--verbose`** flag for detailed test output
4. **Check mock call history** with `mockFunction.mock.calls`

## Continuous Integration

### GitHub Actions

Test workflow (`.github/workflows/test.yml`):

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18, 20]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - run: npm ci
    - run: npm run typecheck
    - run: npm run lint
    - run: npm run test:coverage
    
    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
```

## Best Practices

### Test Writing

1. **Write tests first** (TDD) for complex logic
2. **Use descriptive test names** that explain the scenario
3. **Test the public interface**, not implementation details
4. **Mock external dependencies** consistently
5. **Keep tests focused** - one assertion per test when possible

### Test Maintenance

1. **Update tests with code changes** - don't ignore failing tests
2. **Refactor tests** when code is refactored
3. **Remove obsolete tests** when features are removed
4. **Keep test data realistic** but minimal

### Performance

1. **Use `beforeEach` sparingly** - prefer test-specific setup
2. **Mock heavy operations** like file I/O and network calls
3. **Run tests in parallel** when possible
4. **Clean up resources** in `afterEach`/`afterAll`

By following this testing guide, you'll help maintain the high quality and reliability of the Spotify MCP Server while enabling confident refactoring and feature development.