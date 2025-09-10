/**
 * Enums and constants for OpenOracle SDK
 */

export enum OracleProvider {
  CHAINLINK = 'chainlink',
  PYTH = 'pyth',
  UMA = 'uma',
  BAND = 'band',
  API3 = 'api3',
  DIA = 'dia',
  TELLOR = 'tellor',
  SUPRA = 'supra',
  FLUX = 'flux',
  REDSTONE = 'redstone'
}

export enum DataCategory {
  PRICE = 'price',
  SPORTS = 'sports',
  WEATHER = 'weather',
  ECONOMIC = 'economic',
  NFT = 'nft',
  SOCIAL = 'social',
  NEWS = 'news',
  CRYPTO = 'crypto',
  STOCKS = 'stocks',
  COMMODITIES = 'commodities',
  FOREX = 'forex',
  DEFI = 'defi',
  CUSTOM = 'custom'
}

export enum UpdateFrequency {
  REALTIME = 'realtime',
  SECOND = 'second',
  MINUTE = 'minute',
  HOUR = 'hour',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  ON_DEMAND = 'on_demand'
}

export enum ResolutionMethod {
  AUTOMATED = 'automated',
  MANUAL = 'manual',
  VOTING = 'voting',
  CONSENSUS = 'consensus',
  OPTIMISTIC = 'optimistic',
  CHALLENGE = 'challenge'
}

export enum OracleCapability {
  PRICE_FEEDS = 'price_feeds',
  VRF = 'vrf',
  AUTOMATION = 'automation',
  EXTERNAL_ADAPTERS = 'external_adapters',
  PROOF_OF_RESERVE = 'proof_of_reserve',
  CCIP = 'ccip',
  FUNCTIONS = 'functions',
  SPORTS_DATA = 'sports_data',
  WEATHER_DATA = 'weather_data',
  ECONOMIC_DATA = 'economic_data',
  NFT_DATA = 'nft_data'
}

export enum ConfidenceLevel {
  VERY_LOW = 'very_low',
  LOW = 'low', 
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum RoutingStrategy {
  COST_OPTIMIZED = 'cost_optimized',
  SPEED_OPTIMIZED = 'speed_optimized',
  ACCURACY_OPTIMIZED = 'accuracy_optimized',
  BALANCED = 'balanced',
  REDUNDANT = 'redundant'
}

export enum NetworkStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  DEGRADED = 'degraded',
  MAINTENANCE = 'maintenance'
}

export enum CacheStrategy {
  NO_CACHE = 'no_cache',
  MEMORY_ONLY = 'memory_only',
  PERSISTENT = 'persistent',
  HYBRID = 'hybrid'
}

// Network/Chain identifiers
export enum ChainId {
  ETHEREUM = 1,
  POLYGON = 137,
  BSC = 56,
  AVALANCHE = 43114,
  ARBITRUM = 42161,
  OPTIMISM = 10,
  FANTOM = 250,
  FLOW_EVM = 545,
  FLOW_TESTNET = 646
}

export const SUPPORTED_CHAINS = [
  ChainId.ETHEREUM,
  ChainId.POLYGON,
  ChainId.BSC,
  ChainId.AVALANCHE,
  ChainId.ARBITRUM,
  ChainId.OPTIMISM,
  ChainId.FLOW_EVM,
  ChainId.FLOW_TESTNET
] as const

export type SupportedChain = typeof SUPPORTED_CHAINS[number]