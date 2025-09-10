import { Decimal } from 'decimal.js'

// ============ Enums ============

export enum OracleProvider {
  CHAINLINK = 'chainlink',
  PYTH = 'pyth',
  BAND = 'band',
  UMA = 'uma',
  API3 = 'api3',
  DIA = 'dia',
  TELLOR = 'tellor',
  SUPRA = 'supra',
}

export enum DataCategory {
  PRICE = 'price',
  SPORTS = 'sports',
  WEATHER = 'weather',
  ELECTION = 'election',
  ECONOMIC = 'economic',
  RANDOM = 'random',
  CUSTOM = 'custom',
  EVENTS = 'events',
  STOCKS = 'stocks',
  FOREX = 'forex',
  COMMODITIES = 'commodities',
  NFT = 'nft',
}

export enum UpdateFrequency {
  REALTIME = 'realtime',
  HIGH_FREQ = 'high_freq',
  MEDIUM_FREQ = 'medium_freq',
  LOW_FREQ = 'low_freq',
  HOURLY = 'hourly',
  DAILY = 'daily',
  ON_DEMAND = 'on_demand',
}

// ============ Base Types ============

export interface BaseOracleResponse {
  success: boolean
  timestamp: string
  error?: string
}

// ============ Chainlink Types ============

export interface ChainlinkPriceFeed {
  feed_id: string
  pair: string
  decimals: number
  latest_answer: Decimal
  updated_at: string
  round_id: number
  answered_in_round: number
  min_answer?: Decimal
  max_answer?: Decimal
  heartbeat?: number
  num_oracles?: number
  aggregator_address?: string
  proxy_address?: string
}

export interface ChainlinkVRFRequest {
  request_id: string
  subscription_id: number
  num_words: number
  callback_gas_limit: number
  confirmation_blocks: number
}

export interface ChainlinkFunctionsRequest {
  source_code: string
  secrets?: Record<string, string>
  args: string[]
  subscription_id: number
  callback_gas_limit: number
}

export interface ChainlinkAPIResponse {
  job_id: string
  request_id: string
  result: string | number | Record<string, any>
  fulfilled: boolean
  error?: string
}

// ============ Pyth Types ============

export interface PythPriceFeed {
  feed_id: string
  symbol: string
  price: Decimal
  confidence: Decimal
  expo: number
  publish_time: string
  ema_price?: Decimal
  ema_confidence?: Decimal
  num_publishers: number
  max_num_publishers: number
  price_components?: Record<string, any>[]
}

export interface PythUpdateData {
  update_data: string[]
  update_fee: number
  valid_time: string
}

// ============ Oracle Routing ============

export interface OracleCapability {
  provider: OracleProvider
  data_categories: DataCategory[]
  supported_chains: string[]
  update_frequency: UpdateFrequency
  latency_ms: number
  cost_estimate_usd?: Decimal
  reliability_score: number
}

export interface OracleRoutingRequest {
  question: string
  category_hint?: DataCategory
  required_chains?: string[]
  max_latency_ms?: number
  max_cost_usd?: Decimal
  preferred_providers?: OracleProvider[]
}

export interface OracleRoutingResponse extends BaseOracleResponse {
  can_resolve: boolean
  selected_oracle?: OracleProvider
  reasoning: string
  oracle_config?: Record<string, any>
  alternatives?: OracleProvider[]
  data_type?: DataCategory
  required_feeds?: string[]
  estimated_cost_usd?: Decimal
  estimated_latency_ms?: number
  confidence_score: number
  resolution_method?: 'direct' | 'aggregated' | 'optimistic'
  update_frequency?: UpdateFrequency
}

// ============ Oracle Data ============

export interface OracleDataPoint {
  provider: OracleProvider
  data_type: DataCategory
  value: string | number | boolean | Record<string, any>
  timestamp: string
  confidence?: number
  metadata?: Record<string, any>
}

export interface OraclePollData {
  poll_id: string
  oracle_provider: OracleProvider
  data_points: OracleDataPoint[]
  resolution_criteria: string
  resolution_time?: string
  auto_resolve: boolean
  proof?: string
  attestation?: string
}

export interface AggregatedOracleData {
  data_type: DataCategory
  providers: OracleProvider[]
  aggregation_method: 'median' | 'mean' | 'weighted' | 'unanimous'
  aggregated_value: string | number | boolean
  individual_values: Record<string, any>
  timestamp: string
  confidence: number
  discrepancy_detected: boolean
}

export interface OracleHealthStatus {
  provider: OracleProvider
  is_healthy: boolean
  last_update: string
  active_feeds: number
  error_rate: number
  average_latency_ms: number
  status_message: string
}

// ============ Price Feed Types ============

export interface PriceFeedData {
  provider: string
  pair?: string
  symbol?: string
  price: number | string
  timestamp: string
  confidence?: number
  metadata?: Record<string, any>
}

export interface AggregatedPrice {
  asset: string
  aggregated_price: number | string
  aggregation_method: string
  providers: string[]
  individual_values: Record<string, any>
  confidence: number
  discrepancy_detected: boolean
  timestamp: string
}

// ============ Poll Types ============

export interface PollCreationRequest {
  question: string
  poll_id: string
  auto_resolve?: boolean
}

export interface PollCreationResponse extends BaseOracleResponse {
  poll_id: string
  oracle_provider?: string
  resolution_criteria: string
  auto_resolve: boolean
  oracle_supported: boolean
  message?: string
}

export interface PollResolution {
  resolved: boolean
  winning_option?: string
  oracle_value?: number
  proof?: string
  reason?: string
  timestamp?: string
}

// ============ API Response Types ============

export interface OracleHealthCheckResponse {
  overall_status: 'healthy' | 'degraded' | 'down'
  providers: Record<string, {
    status: 'healthy' | 'degraded' | 'down'
    last_update: string
    active_feeds?: number
    active_requests?: number
  }>
  timestamp: string
}

export interface SupportedFeedsResponse {
  [provider: string]: {
    [category: string]: string[]
  }
}

// ============ Utility Types ============

export interface ApiError extends Error {
  status?: number
  code?: string
  details?: Record<string, any>
}

export interface ApiConfig {
  baseUrl: string
  apiKey?: string
  timeout?: number
  headers?: Record<string, string>
}

export interface OracleHookConfig {
  enabled?: boolean
  refetchInterval?: number
  staleTime?: number
  cacheTime?: number
}