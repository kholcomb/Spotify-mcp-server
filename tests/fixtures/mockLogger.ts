/**
 * Mock Logger for Testing
 * 
 * Provides a mock logger implementation with Jest spy functions
 * for testing logging behavior in the application.
 */

import type { Logger } from '../../src/types/index.js';

export const createMockLogger = (): jest.Mocked<Logger> => {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
};

export const mockLogger = createMockLogger();