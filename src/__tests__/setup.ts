// Jest setup file

// Setup global mocks
const originalConsole = global.console;
global.console = {
  ...console,
  // Suppress console.log during tests unless running in verbose mode
  log: process.env.JEST_VERBOSE ? console.log : jest.fn(),
  warn: process.env.JEST_VERBOSE ? console.warn : jest.fn(),
  error: console.error, // Keep error logging
};

// Clean up global state after each test
afterEach(() => {
  // Clear the global MongoDB connector cache
  if (globalThis.__NEXT_MONGO_CONNECTOR__) {
    globalThis.__NEXT_MONGO_CONNECTOR__.connections.clear();
  }
  
  // Reset environment variables
  delete process.env.MONGODB_URI;
  delete process.env.MONGO_URI;
  
  // Clear all mocks
  jest.clearAllMocks();
});

// Setup test timeout
jest.setTimeout(30000);
