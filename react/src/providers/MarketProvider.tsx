import React, { createContext, useContext, ReactNode, useCallback, useEffect } from 'react'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'
import { useMarkets } from '../hooks/useMarkets'
import type {
  Poll,
  UserPosition,
  Portfolio,
  MarketUpdate,
  PollFilters,
  CreateMarketRequest,
  BetRequest,
  RealtimeConfig
} from '../types'

// ============ Market Store Types ============

interface MarketStore {
  // State
  polls: Poll[]
  userPositions: UserPosition[]
  portfolio: Portfolio | null
  filters: PollFilters
  selectedPoll: Poll | null
  subscriptions: Set<string>
  realtimeConfig: RealtimeConfig
  
  // Actions
  setPolls: (polls: Poll[]) => void
  setPoll: (poll: Poll) => void
  setUserPositions: (positions: UserPosition[]) => void
  setPortfolio: (portfolio: Portfolio) => void
  setFilters: (filters: PollFilters) => void
  setSelectedPoll: (poll: Poll | null) => void
  addSubscription: (pollId: string) => void
  removeSubscription: (pollId: string) => void
  updatePollFromRealtime: (update: MarketUpdate) => void
  
  // Computed
  getActivePollsCount: () => number
  getUserPositionValue: () => number
  getFilteredPolls: () => Poll[]
}

// Create Zustand store
const useMarketStore = create<MarketStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Initial state
      polls: [],
      userPositions: [],
      portfolio: null,
      filters: {},
      selectedPoll: null,
      subscriptions: new Set(),
      realtimeConfig: {
        enabled: true,
        reconnect: true,
        reconnectAttempts: 3,
        reconnectDelay: 1000
      },
      
      // Actions
      setPolls: (polls) => set(state => {
        state.polls = polls
      }),
      
      setPoll: (poll) => set(state => {
        const index = state.polls.findIndex(p => p.id === poll.id)
        if (index >= 0) {
          state.polls[index] = poll
        } else {
          state.polls.push(poll)
        }
      }),
      
      setUserPositions: (positions) => set(state => {
        state.userPositions = positions
      }),
      
      setPortfolio: (portfolio) => set(state => {
        state.portfolio = portfolio
      }),
      
      setFilters: (filters) => set(state => {
        state.filters = { ...state.filters, ...filters }
      }),
      
      setSelectedPoll: (poll) => set(state => {
        state.selectedPoll = poll
      }),
      
      addSubscription: (pollId) => set(state => {
        state.subscriptions.add(pollId)
      }),
      
      removeSubscription: (pollId) => set(state => {
        state.subscriptions.delete(pollId)
      }),
      
      updatePollFromRealtime: (update) => set(state => {
        const poll = state.polls.find(p => p.id === update.poll_id)
        if (poll) {
          switch (update.type) {
            case 'bet_placed':
              // Update poll stats from realtime data
              if (update.data.total_pool !== undefined) {
                poll.total_pool = update.data.total_pool
              }
              if (update.data.options) {
                poll.options = update.data.options
              }
              break
            case 'poll_resolved':
              poll.resolved = true
              poll.resolution_date = update.data.resolution_date
              poll.winning_option = update.data.winning_option
              break
            case 'odds_changed':
              if (update.data.options) {
                poll.options.forEach((option, index) => {
                  if (update.data.options[index]) {
                    Object.assign(option, update.data.options[index])
                  }
                })
              }
              break
          }
        }
      }),
      
      // Computed values
      getActivePollsCount: () => {
        return get().polls.filter(poll => !poll.resolved).length
      },
      
      getUserPositionValue: () => {
        return get().userPositions.reduce((total, position) => {
          return total + position.current_value
        }, 0)
      },
      
      getFilteredPolls: () => {
        const { polls, filters } = get()
        
        return polls.filter(poll => {
          if (filters.category && poll.category !== filters.category) return false
          if (filters.status === 'active' && poll.resolved) return false
          if (filters.status === 'resolved' && !poll.resolved) return false
          if (filters.oracle_backed !== undefined && poll.oracle_backed !== filters.oracle_backed) return false
          if (filters.creator && poll.creator_address !== filters.creator) return false
          if (filters.search) {
            const searchLower = filters.search.toLowerCase()
            if (!poll.question.toLowerCase().includes(searchLower) &&
                !poll.description?.toLowerCase().includes(searchLower)) {
              return false
            }
          }
          return true
        })
      }
    }))
  )
)

// ============ Market Context ============

export interface MarketContextValue {
  // Store state and actions
  store: ReturnType<typeof useMarketStore>
  
  // Enhanced actions with API integration
  createMarket: (request: CreateMarketRequest) => Promise<void>
  placeBet: (request: BetRequest) => Promise<void>
  refreshData: () => Promise<void>
  subscribeToRealtime: (pollId: string) => void
  unsubscribeFromRealtime: (pollId: string) => void
  
  // Loading states
  isLoading: boolean
  error: Error | null
}

const MarketContext = createContext<MarketContextValue | null>(null)

export const useMarketContext = (): MarketContextValue => {
  const context = useContext(MarketContext)
  if (!context) {
    throw new Error('useMarketContext must be used within a MarketProvider')
  }
  return context
}

// ============ Market Provider Component ============

export interface MarketProviderProps {
  children: ReactNode
  userId?: string
  realtimeConfig?: Partial<RealtimeConfig>
  defaultFilters?: PollFilters
}

export const MarketProvider: React.FC<MarketProviderProps> = ({
  children,
  userId,
  realtimeConfig = {},
  defaultFilters = {}
}) => {
  const store = useMarketStore()
  const {
    polls,
    userPositions,
    portfolio,
    createMarketAsync,
    placeBetAsync,
    isLoading,
    error
  } = useMarkets({
    userId,
    filters: store.filters
  })
  
  // Initialize store with default filters
  useEffect(() => {
    if (Object.keys(defaultFilters).length > 0) {
      store.setFilters(defaultFilters)
    }
  }, []) // Run only once on mount
  
  // Sync API data with store
  useEffect(() => {
    if (polls.length > 0) {
      store.setPolls(polls)
    }
  }, [polls, store])
  
  useEffect(() => {
    if (userPositions.length > 0) {
      store.setUserPositions(userPositions)
    }
  }, [userPositions, store])
  
  useEffect(() => {
    if (portfolio) {
      store.setPortfolio(portfolio)
    }
  }, [portfolio, store])
  
  // Enhanced actions
  const createMarket = useCallback(async (request: CreateMarketRequest) => {
    const result = await createMarketAsync.mutateAsync(request)
    // The useMarkets hook will automatically refresh data
  }, [createMarketAsync])
  
  const placeBet = useCallback(async (request: BetRequest) => {
    const result = await placeBetAsync.mutateAsync(request)
    // The useMarkets hook will automatically refresh data
  }, [placeBetAsync])
  
  const refreshData = useCallback(async () => {
    // This would trigger refetch in useMarkets hook
    window.location.reload() // Simplified for now
  }, [])
  
  // Mock WebSocket implementation
  const subscribeToRealtime = useCallback((pollId: string) => {
    store.addSubscription(pollId)
    
    if (realtimeConfig.enabled !== false) {
      // Mock realtime updates - in real implementation, use WebSocket
      const interval = setInterval(() => {
        const mockUpdate: MarketUpdate = {
          type: 'volume_update',
          poll_id: pollId,
          data: {
            total_pool: Math.random() * 1000,
            timestamp: new Date().toISOString()
          },
          timestamp: new Date().toISOString()
        }
        store.updatePollFromRealtime(mockUpdate)
      }, 10000) // Update every 10 seconds
      
      // Store interval for cleanup
      const intervals = (window as any).realtimeIntervals || new Map()
      intervals.set(pollId, interval)
      ;(window as any).realtimeIntervals = intervals
    }
  }, [store, realtimeConfig])
  
  const unsubscribeFromRealtime = useCallback((pollId: string) => {
    store.removeSubscription(pollId)
    
    // Clean up interval
    const intervals = (window as any).realtimeIntervals
    if (intervals?.has(pollId)) {
      clearInterval(intervals.get(pollId))
      intervals.delete(pollId)
    }
  }, [store])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const intervals = (window as any).realtimeIntervals
      if (intervals) {
        intervals.forEach((interval: any) => clearInterval(interval))
        intervals.clear()
      }
    }
  }, [])
  
  const contextValue: MarketContextValue = {
    store,
    createMarket,
    placeBet,
    refreshData,
    subscribeToRealtime,
    unsubscribeFromRealtime,
    isLoading,
    error
  }
  
  return (
    <MarketContext.Provider value={contextValue}>
      {children}
    </MarketContext.Provider>
  )
}

// ============ Market Statistics Component ============

export interface MarketStatsProps {
  className?: string
  style?: React.CSSProperties
}

export const MarketStats: React.FC<MarketStatsProps> = ({ className, style }) => {
  const { store } = useMarketContext()
  const activePollsCount = store.getActivePollsCount()
  const userPositionValue = store.getUserPositionValue()
  
  return (
    <div className={className} style={style}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
        <div style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007acc' }}>
            {store.polls.length}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>Total Markets</div>
        </div>
        
        <div style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
            {activePollsCount}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>Active Markets</div>
        </div>
        
        <div style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffc107' }}>
            {store.userPositions.length}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>Your Positions</div>
        </div>
        
        <div style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#17a2b8' }}>
            ${userPositionValue.toFixed(2)}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>Position Value</div>
        </div>
      </div>
    </div>
  )
}

// ============ Market Filters Component ============

export interface MarketFiltersProps {
  className?: string
  style?: React.CSSProperties
}

export const MarketFilters: React.FC<MarketFiltersProps> = ({ className, style }) => {
  const { store } = useMarketContext()
  
  const handleFilterChange = (key: keyof PollFilters, value: any) => {
    store.setFilters({ [key]: value })
  }
  
  return (
    <div className={className} style={style}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'bold' }}>
            Status
          </label>
          <select
            value={store.filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
            <option value="expired">Expired</option>
          </select>
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'bold' }}>
            Category
          </label>
          <select
            value={store.filters.category || ''}
            onChange={(e) => handleFilterChange('category', e.target.value || undefined)}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          >
            <option value="">All Categories</option>
            <option value="crypto">Crypto</option>
            <option value="sports">Sports</option>
            <option value="politics">Politics</option>
            <option value="entertainment">Entertainment</option>
          </select>
        </div>
        
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={store.filters.oracle_backed || false}
              onChange={(e) => handleFilterChange('oracle_backed', e.target.checked || undefined)}
            />
            Oracle Backed Only
          </label>
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'bold' }}>
            Search
          </label>
          <input
            type="text"
            placeholder="Search markets..."
            value={store.filters.search || ''}
            onChange={(e) => handleFilterChange('search', e.target.value || undefined)}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>
      </div>
    </div>
  )
}

// ============ Higher-Order Component ============

export interface WithMarketProps {
  market: MarketContextValue
}

export const withMarket = <P extends WithMarketProps>(
  Component: React.ComponentType<P>
) => {
  return (props: Omit<P, 'market'>) => {
    const market = useMarketContext()
    return <Component {...(props as P)} market={market} />
  }
}