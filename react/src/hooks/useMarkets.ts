import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import { getDefaultAPI } from '../services/api'
import type {
  Poll,
  PollFilters,
  CreateMarketRequest,
  CreateMarketResponse,
  BetRequest,
  BetResponse,
  MarketAnalytics,
  UserPosition,
  Portfolio,
  PollStats,
  MarketUpdate,
  HookConfig,
  ApiError
} from '../types'

// ============ Markets Management Hook ============

export interface UseMarketsOptions extends HookConfig {
  filters?: PollFilters
  realtime?: boolean
  userId?: string
}

export interface UseMarketsReturn {
  // Data
  polls: Poll[]
  userPositions: UserPosition[]
  portfolio: Portfolio | null
  
  // Actions
  createMarket: (request: CreateMarketRequest) => Promise<CreateMarketResponse>
  placeBet: (request: BetRequest) => Promise<BetResponse>
  refreshPolls: () => Promise<void>
  refreshUserData: () => Promise<void>
  
  // Async mutations
  createMarketAsync: ReturnType<typeof useMutation<CreateMarketResponse, ApiError, CreateMarketRequest>>
  placeBetAsync: ReturnType<typeof useMutation<BetResponse, ApiError, BetRequest>>
  
  // Loading states
  isLoading: boolean
  isCreatingMarket: boolean
  isPlacingBet: boolean
  isRefreshing: boolean
  
  // Errors
  error: ApiError | null
  createError: ApiError | null
  betError: ApiError | null
  
  // Utilities
  getPoll: (pollId: string) => Poll | undefined
  getUserPosition: (pollId: string) => UserPosition | undefined
  subscribeToUpdates: (pollId: string) => void
  unsubscribeFromUpdates: (pollId: string) => void
}

export const useMarkets = (options: UseMarketsOptions = {}): UseMarketsReturn => {
  const api = getDefaultAPI()
  const queryClient = useQueryClient()
  
  // Polls query
  const pollsQuery = useQuery({
    queryKey: ['polls', options.filters],
    queryFn: () => api.getPolls(options.filters),
    enabled: options.enabled !== false,
    staleTime: 30000, // 30 seconds
    ...options
  })
  
  // User positions query (only if userId provided)
  const userPositionsQuery = useQuery({
    queryKey: ['user-positions', options.userId],
    queryFn: () => api.request({ url: `/api/users/${options.userId}/positions` }),
    enabled: !!options.userId && options.enabled !== false,
    staleTime: 60000, // 1 minute
    ...options
  })
  
  // Portfolio query (only if userId provided)
  const portfolioQuery = useQuery({
    queryKey: ['portfolio', options.userId],
    queryFn: () => api.request({ url: `/api/users/${options.userId}/portfolio` }),
    enabled: !!options.userId && options.enabled !== false,
    staleTime: 60000, // 1 minute
    ...options
  })
  
  // Create market mutation
  const createMarketMutation = useMutation({
    mutationFn: (request: CreateMarketRequest) => api.createPoll(request),
    onSuccess: () => {
      // Invalidate polls query to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['polls'] })
    },
    retry: 1
  })
  
  // Place bet mutation
  const placeBetMutation = useMutation({
    mutationFn: async (request: BetRequest) => {
      const response = await api.votePoll(request.poll_id, {
        option_id: request.option_id,
        amount: request.amount,
        slippage_tolerance: request.slippage_tolerance
      })
      return response
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['polls'] })
      queryClient.invalidateQueries({ queryKey: ['user-positions'] })
      queryClient.invalidateQueries({ queryKey: ['portfolio'] })
      queryClient.invalidateQueries({ queryKey: ['poll', variables.poll_id] })
    },
    retry: 1
  })
  
  // Methods
  const createMarket = useCallback(
    (request: CreateMarketRequest) => createMarketMutation.mutateAsync(request),
    [createMarketMutation]
  )
  
  const placeBet = useCallback(
    (request: BetRequest) => placeBetMutation.mutateAsync(request),
    [placeBetMutation]
  )
  
  const refreshPolls = useCallback(
    () => pollsQuery.refetch(),
    [pollsQuery]
  )
  
  const refreshUserData = useCallback(async () => {
    await Promise.all([
      userPositionsQuery.refetch(),
      portfolioQuery.refetch()
    ])
  }, [userPositionsQuery, portfolioQuery])
  
  const getPoll = useCallback(
    (pollId: string) => pollsQuery.data?.find((poll: Poll) => poll.id === pollId),
    [pollsQuery.data]
  )
  
  const getUserPosition = useCallback(
    (pollId: string) => userPositionsQuery.data?.find(
      (position: UserPosition) => position.poll_id === pollId
    ),
    [userPositionsQuery.data]
  )
  
  // WebSocket subscriptions for real-time updates
  const subscribeToUpdates = useCallback((pollId: string) => {
    // This would be implemented with WebSocket connection
    // For now, increase refetch frequency for subscribed polls
    queryClient.setQueryDefaults(['poll', pollId], {
      refetchInterval: 5000
    })
  }, [queryClient])
  
  const unsubscribeFromUpdates = useCallback((pollId: string) => {
    queryClient.setQueryDefaults(['poll', pollId], {
      refetchInterval: false
    })
  }, [queryClient])
  
  return {
    // Data
    polls: pollsQuery.data || [],
    userPositions: userPositionsQuery.data || [],
    portfolio: portfolioQuery.data || null,
    
    // Actions
    createMarket,
    placeBet,
    refreshPolls,
    refreshUserData,
    
    // Async mutations
    createMarketAsync: createMarketMutation,
    placeBetAsync: placeBetMutation,
    
    // Loading states
    isLoading: pollsQuery.isLoading || userPositionsQuery.isLoading || portfolioQuery.isLoading,
    isCreatingMarket: createMarketMutation.isPending,
    isPlacingBet: placeBetMutation.isPending,
    isRefreshing: pollsQuery.isFetching,
    
    // Errors
    error: pollsQuery.error || userPositionsQuery.error || portfolioQuery.error,
    createError: createMarketMutation.error,
    betError: placeBetMutation.error,
    
    // Utilities
    getPoll,
    getUserPosition,
    subscribeToUpdates,
    unsubscribeFromUpdates
  }
}

// ============ Individual Poll Hook ============

export interface UsePollOptions extends HookConfig {
  pollId: string
  includeStats?: boolean
  includeAnalytics?: boolean
  realtime?: boolean
}

export const usePoll = (options: UsePollOptions) => {
  const api = getDefaultAPI()
  const queryClient = useQueryClient()
  
  const { pollId, includeStats = false, includeAnalytics = false, realtime = false } = options
  
  // Poll data query
  const pollQuery = useQuery({
    queryKey: ['poll', pollId],
    queryFn: () => api.getPoll(pollId),
    enabled: !!pollId && options.enabled !== false,
    staleTime: realtime ? 5000 : 30000,
    refetchInterval: realtime ? 10000 : false,
    ...options
  })
  
  // Poll stats query
  const statsQuery = useQuery({
    queryKey: ['poll-stats', pollId],
    queryFn: () => api.getPollStats(pollId),
    enabled: !!pollId && includeStats && options.enabled !== false,
    staleTime: 30000,
    ...options
  })
  
  // Market analytics query
  const analyticsQuery = useQuery({
    queryKey: ['poll-analytics', pollId],
    queryFn: () => api.request({ url: `/api/polls/${pollId}/analytics` }),
    enabled: !!pollId && includeAnalytics && options.enabled !== false,
    staleTime: 60000, // 1 minute
    ...options
  })
  
  const refresh = useCallback(() => {
    return Promise.all([
      pollQuery.refetch(),
      includeStats ? statsQuery.refetch() : Promise.resolve(),
      includeAnalytics ? analyticsQuery.refetch() : Promise.resolve()
    ])
  }, [pollQuery, statsQuery, analyticsQuery, includeStats, includeAnalytics])
  
  return {
    poll: pollQuery.data,
    stats: statsQuery.data,
    analytics: analyticsQuery.data,
    isLoading: pollQuery.isLoading || (includeStats && statsQuery.isLoading) || (includeAnalytics && analyticsQuery.isLoading),
    error: pollQuery.error || statsQuery.error || analyticsQuery.error,
    refresh
  }
}

// ============ Portfolio Management Hook ============

export interface UsePortfolioOptions extends HookConfig {
  userId: string
  includeHistory?: boolean
}

export const usePortfolio = (options: UsePortfolioOptions) => {
  const api = getDefaultAPI()
  
  const { userId, includeHistory = true } = options
  
  // Portfolio query
  const portfolioQuery = useQuery({
    queryKey: ['portfolio', userId, includeHistory],
    queryFn: () => api.request({ 
      url: `/api/users/${userId}/portfolio`,
      params: { include_history: includeHistory }
    }),
    enabled: !!userId && options.enabled !== false,
    staleTime: 60000, // 1 minute
    ...options
  })
  
  // Performance metrics
  const getPerformanceMetrics = useCallback(() => {
    const portfolio = portfolioQuery.data
    if (!portfolio) return null
    
    const totalValue = portfolio.total_value || 0
    const totalInvested = portfolio.total_invested || 0
    const totalPnL = totalValue - totalInvested
    const pnlPercentage = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0
    
    return {
      totalValue,
      totalInvested,
      totalPnL,
      pnlPercentage,
      positions: portfolio.positions?.length || 0,
      ...portfolio.performance_metrics
    }
  }, [portfolioQuery.data])
  
  // Position analysis
  const getPositionsByStatus = useCallback((status?: 'open' | 'closed' | 'settled') => {
    const positions = portfolioQuery.data?.positions || []
    return status ? positions.filter((p: UserPosition) => p.status === status) : positions
  }, [portfolioQuery.data])
  
  const getTopPerformers = useCallback((limit: number = 5) => {
    const positions = portfolioQuery.data?.positions || []
    return positions
      .filter((p: UserPosition) => p.unrealized_pnl > 0)
      .sort((a: UserPosition, b: UserPosition) => b.unrealized_pnl - a.unrealized_pnl)
      .slice(0, limit)
  }, [portfolioQuery.data])
  
  const getWorstPerformers = useCallback((limit: number = 5) => {
    const positions = portfolioQuery.data?.positions || []
    return positions
      .filter((p: UserPosition) => p.unrealized_pnl < 0)
      .sort((a: UserPosition, b: UserPosition) => a.unrealized_pnl - b.unrealized_pnl)
      .slice(0, limit)
  }, [portfolioQuery.data])
  
  return {
    portfolio: portfolioQuery.data,
    isLoading: portfolioQuery.isLoading,
    error: portfolioQuery.error,
    refresh: portfolioQuery.refetch,
    
    // Analysis methods
    getPerformanceMetrics,
    getPositionsByStatus,
    getTopPerformers,
    getWorstPerformers
  }
}

// ============ Market Categories Hook ============

export const useMarketCategories = (options: HookConfig = {}) => {
  const api = getDefaultAPI()
  
  return useQuery({
    queryKey: ['market-categories'],
    queryFn: () => api.request({ url: '/api/polls/categories' }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: options.enabled !== false,
    ...options
  })
}

// ============ Trending Markets Hook ============

export const useTrendingMarkets = (options: HookConfig & { limit?: number } = {}) => {
  const { limit = 10, ...queryOptions } = options
  const api = getDefaultAPI()
  
  return useQuery({
    queryKey: ['trending-markets', limit],
    queryFn: () => api.request({ 
      url: '/api/polls/trending',
      params: { limit }
    }),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    enabled: options.enabled !== false,
    ...queryOptions
  })
}