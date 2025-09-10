/**
 * Data schemas and models for OpenOracle SDK
 */

import { OracleProvider, DataCategory, UpdateFrequency, ResolutionMethod, OracleCapability, ConfidenceLevel } from '../types/enums'

export interface OracleDataPoint {
  value: number | string | boolean
  timestamp: Date
  source: string
  confidence: ConfidenceLevel
  metadata?: Record<string, any>
}

export interface OracleRoutingRequest {
  query: string
  category: DataCategory
  requiredProviders?: OracleProvider[]
  excludedProviders?: OracleProvider[]
  maxProviders?: number
  consensusThreshold?: number
  timeoutMs?: number
  cacheEnabled?: boolean
  metadata?: Record<string, any>
}

export interface OracleRoutingResponse {
  oracleProvider: OracleProvider
  confidence: ConfidenceLevel
  data: OracleDataPoint[]
  reasoning: string
  alternativeProviders: OracleProvider[]
  executionTimeMs: number
  cached: boolean
  metadata?: Record<string, any>
}

export interface AggregatedOracleData {
  aggregatedValue: number | string | boolean
  individualDataPoints: OracleDataPoint[]
  consensus: boolean
  confidence: ConfidenceLevel
  providers: OracleProvider[]
  timestamp: Date
  methodology: string
}

export interface ChainlinkPriceFeed {
  feedId: string
  pair: string
  price: number
  timestamp: Date
  decimals: number
  round: number
  updatedAt: Date
}

export interface PythPriceFeed {
  priceId: string
  symbol: string
  price: number
  confidence: number
  timestamp: Date
  status: 'trading' | 'halted' | 'auction'
  previousPrice?: number
  previousTimestamp?: Date
}

export interface OraclePollData {
  pollId: string
  question: string
  options: string[]
  votes: Record<string, number>
  totalVotes: number
  startTime: Date
  endTime: Date
  resolutionMethod: ResolutionMethod
  status: 'active' | 'closed' | 'resolved' | 'cancelled'
  result?: string | number
}

export interface ProviderCapabilities {
  provider: OracleProvider
  capabilities: OracleCapability[]
  supportedCategories: DataCategory[]
  updateFrequencies: UpdateFrequency[]
  costPerQuery: number
  averageResponseTimeMs: number
  reliability: number
  accuracy: number
}

export interface RoutingMetrics {
  providerId: OracleProvider
  requestCount: number
  successCount: number
  errorCount: number
  averageResponseTime: number
  lastUsed: Date
  cost: number
  reliability: number
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  confidence: ConfidenceLevel
}

export interface CacheEntry {
  key: string
  value: any
  timestamp: Date
  ttl: number
  provider: OracleProvider
  hits: number
}

export interface ProviderConfiguration {
  provider: OracleProvider
  enabled: boolean
  apiKey?: string
  endpointUrl?: string
  timeout: number
  retryAttempts: number
  rateLimit?: number
  customParams?: Record<string, any>
}

export interface NetworkConfiguration {
  chainId: number
  name: string
  rpcUrl: string
  explorerUrl?: string
  nativeToken: string
  blockTime: number
}

// Type guards
export function isOracleDataPoint(obj: any): obj is OracleDataPoint {
  return obj && 
    typeof obj === 'object' &&
    ('value' in obj) &&
    ('timestamp' in obj) &&
    ('source' in obj) &&
    ('confidence' in obj)
}

export function isOracleRoutingRequest(obj: any): obj is OracleRoutingRequest {
  return obj && 
    typeof obj === 'object' &&
    typeof obj.query === 'string' &&
    Object.values(DataCategory).includes(obj.category)
}

export function isOracleRoutingResponse(obj: any): obj is OracleRoutingResponse {
  return obj && 
    typeof obj === 'object' &&
    Object.values(OracleProvider).includes(obj.oracleProvider) &&
    Object.values(ConfidenceLevel).includes(obj.confidence) &&
    Array.isArray(obj.data)
}

// Validation functions
export function validateOracleRequest(request: Partial<OracleRoutingRequest>): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!request.query) {
    errors.push('Query is required')
  } else if (request.query.length < 3) {
    errors.push('Query must be at least 3 characters long')
  }

  if (!request.category) {
    errors.push('Category is required')
  } else if (!Object.values(DataCategory).includes(request.category)) {
    errors.push('Invalid category')
  }

  if (request.maxProviders && request.maxProviders < 1) {
    errors.push('Max providers must be at least 1')
  }

  if (request.consensusThreshold && (request.consensusThreshold < 0 || request.consensusThreshold > 1)) {
    errors.push('Consensus threshold must be between 0 and 1')
  }

  if (request.timeoutMs && request.timeoutMs < 1000) {
    warnings.push('Timeout less than 1 second may cause failures')
  }

  const confidence = errors.length === 0 ? 
    (warnings.length === 0 ? ConfidenceLevel.VERY_HIGH : ConfidenceLevel.HIGH) :
    ConfidenceLevel.LOW

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    confidence
  }
}

export function validateProviderConfiguration(config: Partial<ProviderConfiguration>): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!config.provider) {
    errors.push('Provider is required')
  } else if (!Object.values(OracleProvider).includes(config.provider)) {
    errors.push('Invalid provider')
  }

  if (config.timeout && config.timeout < 1000) {
    warnings.push('Timeout less than 1 second may cause failures')
  }

  if (config.retryAttempts && config.retryAttempts < 0) {
    errors.push('Retry attempts must be non-negative')
  }

  if (config.rateLimit && config.rateLimit < 1) {
    errors.push('Rate limit must be at least 1')
  }

  const confidence = errors.length === 0 ? 
    (warnings.length === 0 ? ConfidenceLevel.VERY_HIGH : ConfidenceLevel.HIGH) :
    ConfidenceLevel.LOW

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    confidence
  }
}