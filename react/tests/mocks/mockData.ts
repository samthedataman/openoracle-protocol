// Mock data for testing
import type {
  Poll,
  OracleHealthCheckResponse,
  SupportedFeedsResponse,
  OracleRoutingResponse,
  PriceFeedData,
  ConnectedWallet,
  UserPosition,
  Portfolio
} from '../../src/types'

export const mockPoll: Poll = {
  id: 'poll-123',
  question: 'Will Bitcoin reach $100,000 by the end of 2024?',
  description: 'A prediction market about Bitcoin price target',
  options: [
    { id: 1, text: 'Yes', votes: 150, percentage: 60, payout_multiplier: 1.67 },
    { id: 2, text: 'No', votes: 100, percentage: 40, payout_multiplier: 2.5 }
  ],
  category: 'crypto',
  creator_address: '0x742d35Cc6634C0532925a3b8D497943e7f163417',
  created_at: '2024-01-15T10:00:00Z',
  expires_at: '2024-12-31T23:59:59Z',
  resolved: false,
  total_pool: 5000,
  oracle_provider: 'chainlink',
  oracle_backed: true,
  auto_resolve: true,
  resolution_criteria: 'Resolves based on Chainlink BTC/USD price feed at expiration'
}

export const mockResolvedPoll: Poll = {
  ...mockPoll,
  id: 'poll-456',
  question: 'Did Ethereum hit $5,000 in 2023?',
  resolved: true,
  resolution_date: '2024-01-01T00:00:00Z',
  winning_option: 2
}

export const mockOracleHealth: OracleHealthCheckResponse = {
  overall_status: 'healthy',
  providers: {
    chainlink: {
      status: 'healthy',
      last_update: '2024-01-20T12:00:00Z',
      active_feeds: 50
    },
    pyth: {
      status: 'healthy', 
      last_update: '2024-01-20T12:00:01Z',
      active_feeds: 200
    },
    band: {
      status: 'degraded',
      last_update: '2024-01-20T11:59:00Z',
      active_feeds: 25
    }
  },
  timestamp: '2024-01-20T12:00:00Z'
}

export const mockSupportedFeeds: SupportedFeedsResponse = {
  chainlink: {
    price: ['ETH/USD', 'BTC/USD', 'LINK/USD'],
    sports: ['NFL/SCORES', 'NBA/SCORES'],
    weather: ['TEMP/NYC']
  },
  pyth: {
    price: ['BTC/USD', 'ETH/USD', 'SOL/USD'],
  },
  band: {
    price: ['BTC/USD', 'ETH/USD'],
    custom: ['Custom data requests']
  }
}

export const mockOracleRouting: OracleRoutingResponse = {
  success: true,
  timestamp: '2024-01-20T12:00:00Z',
  can_resolve: true,
  selected_oracle: 'chainlink',
  reasoning: 'Chainlink provides reliable BTC/USD price feeds',
  oracle_config: {
    feed_address: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    pair: 'BTC/USD'
  },
  alternatives: ['pyth'],
  data_type: 'price',
  required_feeds: ['BTC/USD'],
  estimated_cost_usd: 0.5,
  estimated_latency_ms: 1000,
  confidence_score: 0.95,
  resolution_method: 'direct',
  update_frequency: 'realtime'
}

export const mockPriceFeedData: PriceFeedData = {
  provider: 'chainlink',
  pair: 'BTC/USD',
  price: 65432.10,
  timestamp: '2024-01-20T12:00:00Z',
  confidence: 0.98,
  metadata: {
    round_id: 92233720368547758080,
    decimals: 8
  }
}

export const mockConnectedWallet: ConnectedWallet = {
  address: '0x742d35Cc6634C0532925a3b8D497943e7f163417',
  balance: '1.5',
  network: 545,
  networkName: 'Flow EVM Testnet',
  connector: 'metamask',
  isConnected: true,
  isConnecting: false,
  isReconnecting: false,
  isDisconnected: false
}

export const mockUserPosition: UserPosition = {
  poll_id: 'poll-123',
  poll_question: 'Will Bitcoin reach $100,000 by the end of 2024?',
  option_id: 1,
  option_text: 'Yes',
  amount_invested: 100,
  current_value: 120,
  unrealized_pnl: 20,
  realized_pnl: 0,
  position_size: 60, // 60 shares/votes
  entry_price: 1.67,
  current_price: 2.0,
  status: 'open'
}

export const mockPortfolio: Portfolio = {
  user_address: '0x742d35Cc6634C0532925a3b8D497943e7f163417',
  total_value: 1250,
  total_invested: 1000,
  total_pnl: 250,
  positions: [mockUserPosition],
  transaction_history: [],
  performance_metrics: {
    win_rate: 0.65,
    avg_return: 0.15,
    best_trade: 150,
    worst_trade: -50,
    total_trades: 10
  }
}

// Factory functions for creating test data
export const createMockPoll = (overrides: Partial<Poll> = {}): Poll => ({
  ...mockPoll,
  ...overrides
})

export const createMockPollOption = (id: number, text: string, votes: number = 0) => ({
  id,
  text,
  votes,
  percentage: 0,
  payout_multiplier: 2.0
})

export const createMockPosition = (overrides: Partial<UserPosition> = {}): UserPosition => ({
  ...mockUserPosition,
  ...overrides
})

export const createMockWallet = (overrides: Partial<ConnectedWallet> = {}): ConnectedWallet => ({
  ...mockConnectedWallet,
  ...overrides
})