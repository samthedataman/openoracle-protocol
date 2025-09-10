import React from 'react'
import { render, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useOracle } from '../../src/hooks/useOracle'
import { OracleProvider } from '../../src/providers/OracleProvider'
import { setDefaultAPI } from '../../src/services/api'
import { 
  mockOracleHealth, 
  mockSupportedFeeds, 
  mockOracleRouting,
  mockPriceFeedData,
  mockApiResponse,
  mockApiError
} from '../mocks/mockData'

// Mock API
const mockAPI = {
  getOracleHealth: jest.fn(),
  getSupportedFeeds: jest.fn(),
  routeQuestion: jest.fn(),
  createOraclePoll: jest.fn(),
  getChainlinkPrice: jest.fn(),
  getPythPrice: jest.fn(),
  getAggregatedPrice: jest.fn()
}

jest.mock('../../src/services/api', () => ({
  ...jest.requireActual('../../src/services/api'),
  getDefaultAPI: () => mockAPI
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0
      },
      mutations: {
        retry: false
      }
    }
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <OracleProvider config={{ baseUrl: 'http://localhost:8000', apiKey: 'test-key' }}>
        {children}
      </OracleProvider>
    </QueryClientProvider>
  )
}

describe('useOracle', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default API
    setDefaultAPI({
      baseUrl: 'http://localhost:8000',
      apiKey: 'test-key'
    })
    
    // Default mock implementations
    mockAPI.getOracleHealth.mockImplementation(() => mockApiResponse(mockOracleHealth))
    mockAPI.getSupportedFeeds.mockImplementation(() => mockApiResponse(mockSupportedFeeds))
    mockAPI.routeQuestion.mockImplementation(() => mockApiResponse(mockOracleRouting))
    mockAPI.getChainlinkPrice.mockImplementation(() => mockApiResponse(mockPriceFeedData))
  })

  it('should initialize with correct default state', async () => {
    const { result } = renderHook(() => useOracle(), {
      wrapper: createWrapper()
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.health).toBeUndefined()
    expect(result.current.supportedFeeds).toBeUndefined()
    expect(result.current.isHealthy).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should load oracle health data', async () => {
    const { result } = renderHook(() => useOracle(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.health).toEqual(mockOracleHealth)
    expect(result.current.isHealthy).toBe(true)
    expect(mockAPI.getOracleHealth).toHaveBeenCalledTimes(1)
  })

  it('should load supported feeds data', async () => {
    const { result } = renderHook(() => useOracle(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.supportedFeeds).toEqual(mockSupportedFeeds)
    })

    expect(mockAPI.getSupportedFeeds).toHaveBeenCalledTimes(1)
  })

  it('should route questions correctly', async () => {
    const { result } = renderHook(() => useOracle(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const routingRequest = {
      question: 'Will Bitcoin reach $100,000?',
      category_hint: 'price' as any
    }

    const response = await result.current.routeQuestion(routingRequest)

    expect(response).toEqual(mockOracleRouting)
    expect(mockAPI.routeQuestion).toHaveBeenCalledWith(routingRequest)
  })

  it('should handle routing errors', async () => {
    const errorMessage = 'Routing failed'
    mockAPI.routeQuestion.mockImplementation(() => mockApiError(errorMessage))

    const { result } = renderHook(() => useOracle(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    try {
      await result.current.routeQuestion({ question: 'Test question' })
    } catch (error: any) {
      expect(error.message).toBe(errorMessage)
    }

    expect(result.current.routingError).toBeTruthy()
  })

  it('should create oracle polls', async () => {
    const mockPollResponse = {
      success: true,
      poll_id: 'poll-123',
      oracle_provider: 'chainlink',
      resolution_criteria: 'Price threshold',
      auto_resolve: true,
      oracle_supported: true,
      timestamp: '2024-01-20T12:00:00Z'
    }

    mockAPI.createOraclePoll.mockImplementation(() => mockApiResponse(mockPollResponse))

    const { result } = renderHook(() => useOracle(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const pollRequest = {
      question: 'Will Bitcoin reach $100,000?',
      poll_id: 'poll-123',
      auto_resolve: true
    }

    const response = await result.current.createOraclePoll(pollRequest)

    expect(response).toEqual(mockPollResponse)
    expect(mockAPI.createOraclePoll).toHaveBeenCalledWith(pollRequest)
  })

  it('should handle API errors gracefully', async () => {
    mockAPI.getOracleHealth.mockImplementation(() => mockApiError('Health check failed'))
    mockAPI.getSupportedFeeds.mockImplementation(() => mockApiError('Feeds unavailable'))

    const { result } = renderHook(() => useOracle(), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.health).toBeUndefined()
    expect(result.current.supportedFeeds).toBeUndefined()
    expect(result.current.isHealthy).toBe(false)
    expect(result.current.error).toBeTruthy()
  })

  it('should show correct loading states', async () => {
    const { result } = renderHook(() => useOracle(), {
      wrapper: createWrapper()
    })

    // Initially loading
    expect(result.current.isLoading).toBe(true)
    expect(result.current.isRouting).toBe(false)
    expect(result.current.isCreating).toBe(false)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Start routing
    const routePromise = result.current.routeQuestion({ question: 'Test' })
    expect(result.current.isRouting).toBe(true)

    await routePromise
    expect(result.current.isRouting).toBe(false)
  })

  it('should disable queries when enabled is false', () => {
    const { result } = renderHook(() => useOracle({ enabled: false }), {
      wrapper: createWrapper()
    })

    expect(result.current.isLoading).toBe(false)
    expect(mockAPI.getOracleHealth).not.toHaveBeenCalled()
    expect(mockAPI.getSupportedFeeds).not.toHaveBeenCalled()
  })
})