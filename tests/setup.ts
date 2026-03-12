// Test setup file for Jest
// This file runs before each test suite

// Mock Photoshop UXP APIs for testing
const mockApp = {
  activeDocument: {
    id: 'test-doc-id',
    layers: []
  },
  batchPlay: jest.fn().mockResolvedValue([{ success: true }])
};

const mockEntrypoints = {
  setup: jest.fn()
};

const mockStorage = {
  localFileSystem: {
    getFileForOpening: jest.fn().mockResolvedValue({
      nativePath: '/test/path/image.jpg'
    })
  }
};

// Global mocks
global.app = mockApp;
global.entrypoints = mockEntrypoints;
global.storage = mockStorage;

// Mock DOM elements for UI testing
Object.defineProperty(global, 'document', {
  value: {
    getElementById: jest.fn().mockReturnValue({
      addEventListener: jest.fn(),
      style: { display: 'none', width: '0%' },
      textContent: '',
      className: '',
      value: '#000000'
    })
  }
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
};

// Mock setTimeout for testing
global.setTimeout = jest.fn().mockImplementation((callback) => {
  callback();
  return 1;
});

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});