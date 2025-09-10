import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { getDefaultAPI } from '../services/api'
import type {
  OracleRoutingRequest,
  OracleRoutingResponse,
  PriceFeedData,
  AggregatedPrice,
  PollCreationRequest,
  PollCreationResponse,
  OracleHealthCheckResponse,
  SupportedFeedsResponse,
  HookConfig,
  ApiError
} from '../types'

// ============ Main Oracle Hook ============

export interface UseOracleOptions extends HookConfig {
  apiKey?: string
  baseUrl?: string
}

export interface UseOracleReturn {
  // Question routing
  routeQuestion: (request: OracleRoutingRequest) => Promise<OracleRoutingResponse>
  routeQuestionAsync: ReturnType<typeof useMutation<OracleRoutingResponse, ApiError, OracleRoutingRequest>>
  
  // Poll creation
  createOraclePoll: (request: PollCreationRequest) => Promise<PollCreationResponse>
  createOraclePollAsync: ReturnType<typeof useMutation<PollCreationResponse, ApiError, PollCreationRequest>>
  
  // Health and capabilities
  health: OracleHealthCheckResponse | undefined
  supportedFeeds: SupportedFeedsResponse | undefined
  isHealthy: boolean
  
  // Loading states
  isLoading: boolean
  isRouting: boolean
  isCreating: boolean
  
  // Errors
  error: ApiError | null
  routingError: ApiError | null
  creationError: ApiError | null
}

export const useOracle = (options: UseOracleOptions = {}): UseOracleReturn => {
  const api = getDefaultAPI()
  
  // Health check query
  const healthQuery = useQuery({
    queryKey: ['oracle', 'health'],
    queryFn: () => api.getOracleHealth(),
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 25000,
    enabled: options.enabled !== false,
    retry: 3,
    ...options
  })
  
  // Supported feeds query
  const supportedFeedsQuery = useQuery({
    queryKey: ['oracle', 'supported-feeds'],
    queryFn: () => api.getSupportedFeeds(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: options.enabled !== false,
    retry: 2,
    ...options
  })
  
  // Question routing mutation
  const routeQuestionMutation = useMutation({
    mutationFn: (request: OracleRoutingRequest) => api.routeQuestion(request),
    retry: 1
  })
  
  // Oracle poll creation mutation
  const createOraclePollMutation = useMutation({
    mutationFn: (request: PollCreationRequest) => api.createOraclePoll(request),
    retry: 1
  })
  
  const routeQuestion = useCallback(
    (request: OracleRoutingRequest) => routeQuestionMutation.mutateAsync(request),
    [routeQuestionMutation]
  )
  
  const createOraclePoll = useCallback(
    (request: PollCreationRequest) => createOraclePollMutation.mutateAsync(request),
    [createOraclePollMutation]
  )
  
  return {
    // Methods
    routeQuestion,
    routeQuestionAsync: routeQuestionMutation,
    createOraclePoll,
    createOraclePollAsync: createOraclePollMutation,
    
    // Data
    health: healthQuery.data,
    supportedFeeds: supportedFeedsQuery.data,
    isHealthy: healthQuery.data?.overall_status === 'healthy',
    
    // Loading states
    isLoading: healthQuery.isLoading || supportedFeedsQuery.isLoading,
    isRouting: routeQuestionMutation.isPending,
    isCreating: createOraclePollMutation.isPending,
    
    // Errors
    error: healthQuery.error || supportedFeedsQuery.error,
    routingError: routeQuestionMutation.error,
    creationError: createOraclePollMutation.error
  }
}

// ============ Price Feed Hooks ============

export interface UsePriceFeedOptions extends HookConfig {
  provider?: 'chainlink' | 'pyth' | 'aggregated'
  pair?: string
  symbol?: string
  chain?: string
  providers?: string[]
  refetchInterval?: number
}

export const usePriceFeed = (options: UsePriceFeedOptions = {}) => {
  const api = getDefaultAPI()
  
  const {
    provider = 'aggregated',
    pair = 'ETH/USD',
    symbol = 'BTC/USD',
    chain = 'ethereum',
    providers,
    refetchInterval = 30000, // 30 seconds default
    ...queryOptions
  } = options
  
  const queryKey = ['oracle', 'price-feed', provider, pair, symbol, chain, providers]
  
  const queryFn = async () => {
    switch (provider) {
      case 'chainlink':
        return api.getChainlinkPrice(pair, chain)
      case 'pyth':
        return api.getPythPrice(symbol, chain)
      case 'aggregated':
      default:
        return api.getAggregatedPrice(pair, providers)
    }
  }
  
  return useQuery({
    queryKey,
    queryFn,
    refetchInterval,
    staleTime: refetchInterval - 5000, // Slightly less than refetch interval
    enabled: options.enabled !== false,
    retry: 3,
    ...queryOptions
  })
}

// ============ Oracle Capabilities Hook ============

export const useOracleCapabilities = (options: HookConfig = {}) => {
  const api = getDefaultAPI()
  
  const supportedFeedsQuery = useQuery({
    queryKey: ['oracle', 'capabilities'],
    queryFn: () => api.getSupportedFeeds(),
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: options.enabled !== false,
    ...options
  })
  
  const getProviderCapabilities = useCallback((provider: string) => {
    return supportedFeedsQuery.data?.[provider] || {}
  }, [supportedFeedsQuery.data])
  
  const getProviderFeeds = useCallback((provider: string, category?: string) => {
    const capabilities = getProviderCapabilities(provider)
    return category ? capabilities[category] || [] : capabilities
  }, [getProviderCapabilities])
  
  const getAllProviders = useCallback(() => {
    return Object.keys(supportedFeedsQuery.data || {})
  }, [supportedFeedsQuery.data])
  
  const getSupportedCategories = useCallback((provider?: string) => {
    if (provider) {
      return Object.keys(getProviderCapabilities(provider))
    }
    
    const allCategories = new Set<string>()
    Object.values(supportedFeedsQuery.data || {}).forEach(capabilities => {
      Object.keys(capabilities).forEach(category => allCategories.add(category))
    })
    
    return Array.from(allCategories)
  }, [supportedFeedsQuery.data, getProviderCapabilities])
  
  return {
    data: supportedFeedsQuery.data,
    isLoading: supportedFeedsQuery.isLoading,
    error: supportedFeedsQuery.error,
    getProviderCapabilities,
    getProviderFeeds,
    getAllProviders,
    getSupportedCategories,
    refetch: supportedFeedsQuery.refetch
  }
}

// ============ Real-time Oracle Data Hook ============

export interface UseRealtimePriceOptions extends UsePriceFeedOptions {
  onUpdate?: (data: PriceFeedData | AggregatedPrice) => void
  onError?: (error: Error) => void
}

export const useRealtimePrice = (options: UseRealtimePriceOptions = {}) => {
  const { onUpdate, onError, ...priceFeedOptions } = options
  
  const priceFeedQuery = usePriceFeed({
    ...priceFeedOptions,
    refetchInterval: options.refetchInterval || 5000 // 5 seconds for realtime
  })
  
  // Call onUpdate callback when data changes
  React.useEffect(() => {
    if (priceFeedQuery.data && onUpdate) {
      onUpdate(priceFeedQuery.data)
    }
  }, [priceFeedQuery.data, onUpdate])
  
  // Call onError callback when error occurs
  React.useEffect(() => {
    if (priceFeedQuery.error && onError) {
      onError(priceFeedQuery.error)
    }
  }, [priceFeedQuery.error, onError])
  
  return priceFeedQuery
}

// ============ Oracle Question Analysis Hook ============

export const useQuestionAnalysis = () => {
  const api = getDefaultAPI()
  
  const analyzeQuestionMutation = useMutation({
    mutationFn: async (question: string) => {
      // First route the question to get oracle analysis
      const routingResponse = await api.routeQuestion({ question })
      
      // If it's a Twitter-style question, also get Twitter analysis
      let twitterAnalysis = null
      try {
        twitterAnalysis = await api.analyzeTwitterQuestion(question)
      } catch (error) {
        // Twitter analysis is optional, don't fail if it's not available
        console.warn('Twitter analysis failed:', error)
      }
      
      return {
        oracle: routingResponse,
        twitter: twitterAnalysis
      }
    },
    retry: 1
  })
  
  const analyzeQuestion = useCallback(
    (question: string) => analyzeQuestionMutation.mutateAsync(question),
    [analyzeQuestionMutation]
  )
  
  return {
    analyzeQuestion,
    ...analyzeQuestionMutation,
    isAnalyzing: analyzeQuestionMutation.isPending
  }
}