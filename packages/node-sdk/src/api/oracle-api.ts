/**
 * Oracle API Client - Main API interface for oracle operations
 */

import { OracleClient } from '../core/client'
import { OracleConfig } from '../core/config'
import { 
  OracleProvider, 
  DataCategory, 
  ConfidenceLevel 
} from '../types/enums'
import {
  OracleRoutingRequest,
  OracleRoutingResponse,
  OracleDataPoint,
  AggregatedOracleData,
  ProviderCapabilities,
  ChainlinkPriceFeed,
  PythPriceFeed
} from '../schemas/oracle-schemas'
import { ValidationError, ProviderError } from '../core/exceptions'

export interface PriceQueryOptions {
  symbol: string
  currency?: string
  provider?: OracleProvider
  maxAge?: number
  includeFees?: boolean
}

export interface DataQueryOptions {
  query: string
  category: DataCategory
  providers?: OracleProvider[]
  maxProviders?: number
  consensusRequired?: boolean
  timeoutMs?: number
}

export class OracleAPI {
  private readonly client: OracleClient
  private readonly config: OracleConfig

  constructor(client: OracleClient, config: OracleConfig) {
    this.client = client
    this.config = config
  }

  /**
   * Query price data from oracle providers
   */
  async getPrice(options: PriceQueryOptions): Promise<OracleDataPoint[]> {
    if (!options.symbol) {
      throw new ValidationError('Symbol is required for price queries')
    }

    const response = await this.client.get('/api/oracle/price', {
      params: {
        symbol: options.symbol,
        currency: options.currency || 'USD',
        provider: options.provider,
        max_age: options.maxAge,
        include_fees: options.includeFees
      }
    })

    return response.data || []
  }

  /**
   * Query general data from oracle providers
   */
  async queryData(options: DataQueryOptions): Promise<OracleRoutingResponse> {
    const request: OracleRoutingRequest = {
      query: options.query,
      category: options.category,
      requiredProviders: options.providers,
      maxProviders: options.maxProviders,
      consensusThreshold: options.consensusRequired ? 0.8 : 0.5,
      timeoutMs: options.timeoutMs || this.config.network.timeouts.request
    }

    const response = await this.client.post('/api/oracle/query', request)
    return response
  }

  /**
   * Get Chainlink price feeds
   */
  async getChainlinkFeed(feedId: string, chainId?: number): Promise<ChainlinkPriceFeed> {
    const response = await this.client.get(`/api/oracle/chainlink/feed/${feedId}`, {
      params: { chain_id: chainId }
    })

    return response.data
  }

  /**
   * Get Pyth price feeds
   */
  async getPythFeed(priceId: string): Promise<PythPriceFeed> {
    const response = await this.client.get(`/api/oracle/pyth/price/${priceId}`)
    return response.data
  }

  /**
   * List available Chainlink price feeds
   */
  async listChainlinkFeeds(chainId?: number): Promise<string[]> {
    const response = await this.client.get('/api/oracle/chainlink/feeds', {
      params: { chain_id: chainId }
    })

    return response.data || []
  }

  /**
   * List available Pyth price feeds
   */
  async listPythFeeds(): Promise<string[]> {
    const response = await this.client.get('/api/oracle/pyth/feeds')
    return response.data || []
  }

  /**
   * Get provider capabilities
   */
  async getProviderCapabilities(provider: OracleProvider): Promise<ProviderCapabilities> {
    const response = await this.client.get(`/api/oracle/providers/${provider}/capabilities`)
    return response.data
  }

  /**
   * List all available providers
   */
  async listProviders(): Promise<OracleProvider[]> {
    const response = await this.client.get('/api/oracle/providers')
    return response.data || []
  }

  /**
   * Health check for specific provider
   */
  async checkProviderHealth(provider: OracleProvider): Promise<boolean> {
    try {
      await this.client.get(`/api/oracle/providers/${provider}/health`)
      return true
    } catch {
      return false
    }
  }

  /**
   * Aggregate data from multiple providers
   */
  async aggregateData(
    query: string,
    category: DataCategory,
    providers: OracleProvider[]
  ): Promise<AggregatedOracleData> {
    const response = await this.client.post('/api/oracle/aggregate', {
      query,
      category,
      providers
    })

    return response.data
  }

  /**
   * Subscribe to real-time price updates
   */
  subscribeToPriceUpdates(
    symbol: string,
    callback: (data: OracleDataPoint) => void,
    options?: {
      provider?: OracleProvider
      interval?: number
      currency?: string
    }
  ): EventSource {
    const params = new URLSearchParams({
      symbol,
      ...(options?.provider && { provider: options.provider }),
      ...(options?.interval && { interval: options.interval.toString() }),
      ...(options?.currency && { currency: options.currency })
    })

    return this.client.createEventStream(`/api/oracle/price/stream?${params}`, {
      onData: callback,
      onError: (error) => {
        console.error('Price stream error:', error)
      }
    })
  }

  /**
   * Subscribe to general data updates
   */
  subscribeToDataUpdates(
    query: string,
    category: DataCategory,
    callback: (data: OracleRoutingResponse) => void,
    options?: {
      providers?: OracleProvider[]
      interval?: number
    }
  ): EventSource {
    const params = new URLSearchParams({
      query,
      category,
      ...(options?.providers && { providers: options.providers.join(',') }),
      ...(options?.interval && { interval: options.interval.toString() })
    })

    return this.client.createEventStream(`/api/oracle/data/stream?${params}`, {
      onData: callback,
      onError: (error) => {
        console.error('Data stream error:', error)
      }
    })
  }

  /**
   * Create a custom oracle feed
   */
  async createCustomFeed(
    feedConfig: {
      name: string
      description: string
      category: DataCategory
      sources: Array<{
        provider: OracleProvider
        weight: number
        config: Record<string, any>
      }>
      updateFrequency: string
      aggregationMethod: 'average' | 'median' | 'weighted' | 'consensus'
    }
  ): Promise<{ feedId: string }> {
    const response = await this.client.post('/api/oracle/feeds/custom', feedConfig)
    return response.data
  }

  /**
   * Get custom feed data
   */
  async getCustomFeedData(feedId: string): Promise<OracleDataPoint[]> {
    const response = await this.client.get(`/api/oracle/feeds/custom/${feedId}`)
    return response.data || []
  }

  /**
   * List user's custom feeds
   */
  async listCustomFeeds(): Promise<Array<{
    feedId: string
    name: string
    category: DataCategory
    status: 'active' | 'inactive' | 'error'
    lastUpdate: string
  }>> {
    const response = await this.client.get('/api/oracle/feeds/custom')
    return response.data || []
  }

  /**
   * Delete a custom feed
   */
  async deleteCustomFeed(feedId: string): Promise<boolean> {
    try {
      await this.client.delete(`/api/oracle/feeds/custom/${feedId}`)
      return true
    } catch {
      return false
    }
  }

  /**
   * Batch query multiple data points
   */
  async batchQuery(
    queries: Array<{
      query: string
      category: DataCategory
      provider?: OracleProvider
    }>
  ): Promise<OracleRoutingResponse[]> {
    const response = await this.client.post('/api/oracle/batch', { queries })
    return response.data || []
  }

  /**
   * Get historical data
   */
  async getHistoricalData(
    query: string,
    category: DataCategory,
    timeRange: {
      from: Date
      to: Date
      interval?: '1m' | '5m' | '15m' | '1h' | '1d'
    },
    provider?: OracleProvider
  ): Promise<OracleDataPoint[]> {
    const response = await this.client.get('/api/oracle/historical', {
      params: {
        query,
        category,
        from: timeRange.from.toISOString(),
        to: timeRange.to.toISOString(),
        interval: timeRange.interval || '1h',
        provider
      }
    })

    return response.data || []
  }

  /**
   * Get provider statistics
   */
  async getProviderStats(
    provider: OracleProvider,
    timeRange?: {
      from: Date
      to: Date
    }
  ): Promise<{
    requestCount: number
    successRate: number
    averageResponseTime: number
    uptime: number
    costPerQuery: number
  }> {
    const params: any = { provider }
    if (timeRange) {
      params.from = timeRange.from.toISOString()
      params.to = timeRange.to.toISOString()
    }

    const response = await this.client.get('/api/oracle/providers/stats', { params })
    return response.data
  }
}