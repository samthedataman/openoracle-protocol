import { OracleProvider, DataCategory } from './oracle'

// ============ Poll/Market Types ============

export interface Poll {
  id: string
  question: string
  description?: string
  options: PollOption[]
  category: string
  creator_address: string
  created_at: string
  expires_at?: string
  resolved: boolean
  resolution_date?: string
  winning_option?: number
  total_pool: number
  metadata?: Record<string, any>
  
  // Oracle integration
  oracle_provider?: OracleProvider
  oracle_backed: boolean
  auto_resolve: boolean
  resolution_criteria?: string
}

export interface PollOption {
  id: number
  text: string
  votes: number
  percentage: number
  payout_multiplier?: number
  odds?: number
}

export interface PollStats {
  total_votes: number
  total_volume: number
  unique_voters: number
  option_distribution: Record<number, number>
  time_weighted_stats?: {
    early_voter_bonus: number
    time_decay_factor: number
    current_multiplier: number
  }
}

// ============ Betting/Prediction Types ============

export interface Bet {
  id: string
  poll_id: string
  user_address: string
  option_id: number
  amount: number
  timestamp: string
  payout_multiplier: number
  settled: boolean
  payout_amount?: number
  transaction_hash?: string
}

export interface BetRequest {
  poll_id: string
  option_id: number
  amount: number
  slippage_tolerance?: number
}

export interface BetResponse {
  success: boolean
  bet_id?: string
  transaction_hash?: string
  expected_payout?: number
  actual_multiplier?: number
  error?: string
}

// ============ Market Creation Types ============

export interface CreateMarketRequest {
  question: string
  description?: string
  options: string[]
  category: string
  expires_at?: string
  oracle_backed?: boolean
  auto_resolve?: boolean
  initial_liquidity?: number
  tags?: string[]
  metadata?: Record<string, any>
}

export interface CreateMarketResponse {
  success: boolean
  poll_id?: string
  contract_address?: string
  transaction_hash?: string
  oracle_info?: {
    provider: OracleProvider
    supported: boolean
    resolution_criteria?: string
  }
  error?: string
}

// ============ Market Analytics ============

export interface MarketAnalytics {
  poll_id: string
  volume_24h: number
  volume_total: number
  price_history: PricePoint[]
  volatility: number
  market_cap: number
  liquidity: number
  trader_count: number
  sentiment_analysis?: {
    bullish_percentage: number
    bearish_percentage: number
    neutral_percentage: number
    confidence_score: number
  }
}

export interface PricePoint {
  timestamp: string
  option_id: number
  price: number
  volume: number
}

// ============ Portfolio Types ============

export interface UserPosition {
  poll_id: string
  poll_question: string
  option_id: number
  option_text: string
  amount_invested: number
  current_value: number
  unrealized_pnl: number
  realized_pnl: number
  position_size: number
  entry_price: number
  current_price: number
  status: 'open' | 'closed' | 'settled'
}

export interface Portfolio {
  user_address: string
  total_value: number
  total_invested: number
  total_pnl: number
  positions: UserPosition[]
  transaction_history: Bet[]
  performance_metrics: {
    win_rate: number
    avg_return: number
    best_trade: number
    worst_trade: number
    total_trades: number
  }
}

// ============ News/Twitter Integration ============

export interface NewsEvent {
  id: string
  title: string
  content: string
  source: string
  url: string
  published_at: string
  sentiment: 'positive' | 'negative' | 'neutral'
  confidence: number
  categories: string[]
  suggested_poll?: {
    question: string
    options: string[]
    oracle_resolvable: boolean
  }
}

export interface TwitterAnalysis {
  tweet_id?: string
  question: string
  sentiment_analysis: {
    overall_sentiment: 'bullish' | 'bearish' | 'neutral'
    confidence: number
    key_phrases: string[]
    influencer_mentions: string[]
  }
  oracle_routing: {
    can_resolve: boolean
    provider?: OracleProvider
    data_category?: DataCategory
    resolution_method?: string
  }
  suggested_options: string[]
  market_potential: number
}

// ============ Hook State Types ============

export interface MarketState {
  polls: Poll[]
  userPositions: UserPosition[]
  portfolio: Portfolio | null
  loading: boolean
  error: string | null
}

export interface MarketActions {
  createMarket: (request: CreateMarketRequest) => Promise<CreateMarketResponse>
  placeBet: (request: BetRequest) => Promise<BetResponse>
  fetchPolls: (filters?: PollFilters) => Promise<void>
  fetchUserPositions: (address: string) => Promise<void>
  fetchMarketAnalytics: (pollId: string) => Promise<MarketAnalytics>
  subscribeToMarketUpdates: (pollId: string) => void
  unsubscribeFromMarketUpdates: (pollId: string) => void
}

export interface PollFilters {
  category?: string
  status?: 'active' | 'resolved' | 'expired'
  oracle_backed?: boolean
  creator?: string
  search?: string
  sort_by?: 'created_at' | 'expires_at' | 'volume' | 'activity'
  sort_order?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

// ============ Real-time Updates ============

export interface MarketUpdate {
  type: 'bet_placed' | 'poll_resolved' | 'odds_changed' | 'volume_update'
  poll_id: string
  data: Record<string, any>
  timestamp: string
}

export interface RealtimeConfig {
  enabled: boolean
  reconnect: boolean
  reconnectAttempts?: number
  reconnectDelay?: number
}