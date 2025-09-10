// Test setup for @openoracle/react
import '@testing-library/jest-dom'

// Mock environment variables
process.env.NODE_ENV = 'test'

// Mock console methods for cleaner test output
const originalError = console.error
const originalWarn = console.warn

beforeEach(() => {
  console.error = jest.fn()
  console.warn = jest.fn()
})

afterEach(() => {
  console.error = originalError
  console.warn = originalWarn
})

// Mock window.ethereum for wallet tests
Object.defineProperty(window, 'ethereum', {
  writable: true,
  value: {
    isMetaMask: true,
    request: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
    selectedAddress: '0x742d35Cc6634C0532925a3b8D497943e7f163417'
  }
})

// Mock fetch for API calls
global.fetch = jest.fn()

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve()),
    readText: jest.fn(() => Promise.resolve(''))
  }
})

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}))

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}))

// Suppress React warnings for tests
const originalConsoleWarn = console.warn
beforeEach(() => {
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return
    }
    originalConsoleWarn.call(console, ...args)
  }
})

afterEach(() => {
  console.warn = originalConsoleWarn
})

// Mock timers
jest.useFakeTimers()
afterEach(() => {
  jest.runOnlyPendingTimers()
  jest.useRealTimers()
})

// Global test utilities
export const mockApiResponse = <T>(data: T, delay = 100): Promise<T> => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), delay)
  })
}

export const mockApiError = (message: string, status = 500, delay = 100): Promise<never> => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      const error = new Error(message) as any
      error.status = status
      reject(error)
    }, delay)
  })
}