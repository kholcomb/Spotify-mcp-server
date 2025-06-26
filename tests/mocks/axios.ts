/**
 * Axios mock for testing Spotify API client
 */

export const mockAxiosResponse = {
  data: {},
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {},
};

export const mockAxiosError = {
  response: {
    data: { error: 'test_error' },
    status: 400,
    statusText: 'Bad Request',
    headers: {},
  },
  request: {},
  message: 'Request failed',
  isAxiosError: true,
};

export const mockAxiosInstance = {
  create: jest.fn(() => mockAxiosInstance),
  get: jest.fn(() => Promise.resolve(mockAxiosResponse)),
  post: jest.fn(() => Promise.resolve(mockAxiosResponse)),
  put: jest.fn(() => Promise.resolve(mockAxiosResponse)),
  delete: jest.fn(() => Promise.resolve(mockAxiosResponse)),
  patch: jest.fn(() => Promise.resolve(mockAxiosResponse)),
  request: jest.fn(() => Promise.resolve(mockAxiosResponse)),
  interceptors: {
    request: {
      use: jest.fn(),
      eject: jest.fn(),
    },
    response: {
      use: jest.fn(),
      eject: jest.fn(),
    },
  },
  defaults: {
    headers: {
      common: {},
      get: {},
      post: {},
      put: {},
      patch: {},
      delete: {},
    },
  },
};

// Mock axios default export
const axios = mockAxiosInstance;
export default axios;