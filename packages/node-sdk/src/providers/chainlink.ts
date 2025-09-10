/**
 * Chainlink Oracle Provider
 */

import { BaseOracleProvider, QueryRequest, QueryResponse, ProviderOptions } from './base'
import { OracleConfig } from '../core/config'
import { OracleClient } from '../core/client'
import { 
  OracleProvider, 
  DataCategory, 
  OracleCapability,
  ConfidenceLevel,
  ChainId 
} from '../types/enums'
import { 
  ProviderConfiguration,
  ChainlinkPriceFeed 
} from '../schemas/oracle-schemas'
import { ProviderError, ValidationError } from '../core/exceptions'

export interface ChainlinkQueryOptions extends ProviderOptions {
  feedId?: string
  chainId?: ChainId
  includeHistorical?: boolean
  decimals?: number
}

export interface ChainlinkFeedInfo {
  feedId: string
  name: string
  pair: string
  decimals: number
  proxy: string
  aggregator: string
  phase: number
  heartbeat: number
}

export class ChainlinkProvider extends BaseOracleProvider {
  private readonly baseUrls: Record<ChainId, string> = {
    [ChainId.ETHEREUM]: 'https://api.chain.link',
    [ChainId.POLYGON]: 'https://api.chain.link',
    [ChainId.BSC]: 'https://api.chain.link',
    [ChainId.ARBITRUM]: 'https://api.chain.link',
    [ChainId.OPTIMISM]: 'https://api.chain.link',
    [ChainId.AVALANCHE]: 'https://api.chain.link',
    [ChainId.FANTOM]: 'https://api.chain.link',
    [ChainId.FLOW_EVM]: 'https://api.chain.link',
    [ChainId.FLOW_TESTNET]: 'https://api.chain.link'
  }

  private readonly feedCache = new Map<string, ChainlinkFeedInfo[]>()

  constructor(
    config: OracleConfig,
    client: OracleClient,
    providerConfig: ProviderConfiguration
  ) {
    super(config, client, providerConfig)
  }

  getProviderName(): OracleProvider {
    return OracleProvider.CHAINLINK
  }

  getProviderCapabilities(): OracleCapability[] {
    return [
      OracleCapability.PRICE_FEEDS,
      OracleCapability.VRF,
      OracleCapability.AUTOMATION,
      OracleCapability.EXTERNAL_ADAPTERS,
      OracleCapability.PROOF_OF_RESERVE,
      OracleCapability.CCIP,
      OracleCapability.FUNCTIONS,
      OracleCapability.SPORTS_DATA,
      OracleCapability.WEATHER_DATA,
      OracleCapability.ECONOMIC_DATA
    ]
  }

  getSupportedCategories(): DataCategory[] {
    return [
      DataCategory.PRICE,
      DataCategory.CRYPTO,
      DataCategory.STOCKS,
      DataCategory.FOREX,
      DataCategory.COMMODITIES,
      DataCategory.SPORTS,
      DataCategory.WEATHER,
      DataCategory.ECONOMIC,
      DataCategory.DEFI
    ]
  }

  getEndpointUrl(): string {
    const chainId = this.config.network.defaultChain
    return this.baseUrls[chainId] || this.baseUrls[ChainId.ETHEREUM]
  }

  protected getCostPerQuery(): number {
    return 0.01 // $0.01 per query
  }

  async queryData(request: QueryRequest, options: ChainlinkQueryOptions = {}): Promise<QueryResponse> {
    const startTime = Date.now()

    try {
      switch (request.category) {
        case DataCategory.PRICE:
        case DataCategory.CRYPTO:
        case DataCategory.STOCKS:
        case DataCategory.FOREX:
        case DataCategory.COMMODITIES:
          return await this.queryPriceData(request, options)
        
        case DataCategory.SPORTS:
          return await this.querySportsData(request, options)
        
        case DataCategory.WEATHER:
          return await this.queryWeatherData(request, options)
        
        default:
          return await this.queryGenericData(request, options)
      }
    } catch (error) {
      throw this.createProviderError(
        `Chainlink query failed: ${error instanceof Error ? error.message : String(error)}`,
        error as Error
      )
    }
  }

  /**
   * Query price data from Chainlink price feeds
   */
  private async queryPriceData(
    request: QueryRequest,
    options: ChainlinkQueryOptions
  ): Promise<QueryResponse> {
    const startTime = Date.now()

    // Extract symbol from query
    const symbol = this.extractSymbol(request.query)
    if (!symbol) {
      throw new ValidationError('Could not extract trading pair from query')
    }

    // Find appropriate feed
    const feedInfo = await this.findPriceFeed(symbol, options.chainId)
    if (!feedInfo) {
      throw new ProviderError(`No Chainlink price feed found for ${symbol}`, this.getProviderName())
    }

    try {
      // Get latest price data
      const priceData = await this.client.get(`/v1/feeds/${feedInfo.feedId}/latest`, {
        headers: this.getAuthHeaders(),
        params: this.buildQueryParams({
          format: 'json',
          include_metadata: true
        })
      })

      const feed: ChainlinkPriceFeed = {
        feedId: feedInfo.feedId,
        pair: feedInfo.pair,
        price: priceData.price / Math.pow(10, feedInfo.decimals),
        timestamp: new Date(priceData.timestamp * 1000),
        decimals: feedInfo.decimals,
        round: priceData.round,
        updatedAt: new Date(priceData.updatedAt * 1000)
      }

      // Get historical data if requested
      const dataPoints = [
        this.createDataPoint(
          feed.price,
          `price_feed:${feedInfo.feedId}`,
          ConfidenceLevel.VERY_HIGH,
          {
            pair: feed.pair,
            decimals: feed.decimals,
            round: feed.round,
            feedId: feed.feedId,
            heartbeat: feedInfo.heartbeat
          }
        )
      ]

      if (options.includeHistorical) {
        const historicalData = await this.getHistoricalPriceData(feedInfo.feedId, 24) // Last 24 hours
        dataPoints.push(...historicalData)
      }

      return this.normalizeResponse(
        dataPoints,
        request,
        Date.now() - startTime
      )

    } catch (error) {
      throw this.createProviderError(
        `Failed to fetch price data for ${symbol}`,
        error as Error
      )
    }
  }

  /**
   * Query sports data from Chainlink sports feeds
   */
  private async querySportsData(
    request: QueryRequest,
    options: ChainlinkQueryOptions
  ): Promise<QueryResponse> {
    const startTime = Date.now()

    try {
      // This would integrate with Chainlink Sports Data feeds
      // Currently mock implementation
      const response = await this.client.get('/v1/sports/events', {
        headers: this.getAuthHeaders(),
        params: this.buildQueryParams({
          query: request.query,
          format: 'json'
        })
      })

      const dataPoints = response.events?.map((event: any) => 
        this.createDataPoint(
          event.outcome,
          `sports:${event.eventId}`,
          ConfidenceLevel.HIGH,
          {
            sport: event.sport,
            league: event.league,
            teams: event.teams,
            startTime: event.startTime
          }
        )
      ) || []

      return this.normalizeResponse(dataPoints, request, Date.now() - startTime)

    } catch (error) {
      throw this.createProviderError(
        `Failed to fetch sports data`,
        error as Error
      )
    }
  }

  /**
   * Query weather data from Chainlink weather feeds
   */
  private async queryWeatherData(
    request: QueryRequest,
    options: ChainlinkQueryOptions
  ): Promise<QueryResponse> {
    const startTime = Date.now()

    try {
      // This would integrate with Chainlink Weather Data feeds
      const response = await this.client.get('/v1/weather/current', {
        headers: this.getAuthHeaders(),
        params: this.buildQueryParams({
          query: request.query,
          format: 'json'
        })
      })

      const dataPoints = [
        this.createDataPoint(
          response.temperature,
          'weather:temperature',
          ConfidenceLevel.HIGH,
          {
            location: response.location,
            humidity: response.humidity,
            pressure: response.pressure,
            windSpeed: response.windSpeed,
            conditions: response.conditions
          }
        )
      ]

      return this.normalizeResponse(dataPoints, request, Date.now() - startTime)

    } catch (error) {
      throw this.createProviderError(
        `Failed to fetch weather data`,
        error as Error
      )
    }
  }

  /**
   * Query generic data using Chainlink Functions or External Adapters
   */
  private async queryGenericData(
    request: QueryRequest,
    options: ChainlinkQueryOptions
  ): Promise<QueryResponse> {
    const startTime = Date.now()

    try {
      // This would use Chainlink Functions for custom data queries
      const response = await this.client.post('/v1/functions/execute', {
        source: this.buildFunctionSource(request),
        args: [request.query],
        subscriptionId: this.providerConfig.customParams?.subscriptionId
      }, {
        headers: this.getAuthHeaders()
      })

      const dataPoints = [
        this.createDataPoint(
          response.result,
          'function:custom',
          ConfidenceLevel.MEDIUM,
          {
            executionId: response.executionId,
            gasUsed: response.gasUsed,
            cost: response.cost
          }
        )
      ]

      return this.normalizeResponse(dataPoints, request, Date.now() - startTime)

    } catch (error) {
      throw this.createProviderError(
        `Failed to execute custom function`,
        error as Error
      )
    }
  }

  /**
   * Find price feed for a given symbol
   */
  private async findPriceFeed(
    symbol: string,
    chainId?: ChainId
  ): Promise<ChainlinkFeedInfo | null> {
    const targetChain = chainId || this.config.network.defaultChain
    const cacheKey = `feeds:${targetChain}`

    // Check cache first
    if (!this.feedCache.has(cacheKey)) {
      await this.loadFeedDirectory(targetChain)
    }

    const feeds = this.feedCache.get(cacheKey) || []
    
    // Find exact match first
    let feed = feeds.find(f => 
      f.pair.toLowerCase() === symbol.toLowerCase() ||
      f.name.toLowerCase().includes(symbol.toLowerCase())
    )

    // If no exact match, try partial matches
    if (!feed) {
      const symbolParts = symbol.toLowerCase().split('/').join('')
      feed = feeds.find(f => 
        f.pair.toLowerCase().replace('/', '').includes(symbolParts) ||
        f.name.toLowerCase().replace(/[\s\/]/g, '').includes(symbolParts)
      )
    }

    return feed || null
  }

  /**
   * Load feed directory for a specific chain
   */
  private async loadFeedDirectory(chainId: ChainId): Promise<void> {
    try {
      const response = await this.client.get('/v1/feeds', {
        headers: this.getAuthHeaders(),
        params: { chainId: chainId.toString() }
      })

      const feeds: ChainlinkFeedInfo[] = response.feeds?.map((feed: any) => ({
        feedId: feed.feedId,
        name: feed.name,
        pair: feed.pair,
        decimals: feed.decimals,
        proxy: feed.proxy,
        aggregator: feed.aggregator,
        phase: feed.phase,
        heartbeat: feed.heartbeat
      })) || []

      this.feedCache.set(`feeds:${chainId}`, feeds)

    } catch (error) {
      console.warn(`Failed to load Chainlink feed directory for chain ${chainId}:`, error)
      // Use empty array as fallback
      this.feedCache.set(`feeds:${chainId}`, [])
    }
  }

  /**
   * Extract trading symbol from query
   */
  private extractSymbol(query: string): string | null {
    // Try to extract trading pairs like "BTC/USD", "ETH/USD", etc.
    const pairMatch = query.match(/([A-Z]{2,5})[\/\-\s]([A-Z]{2,5})/i)
    if (pairMatch) {
      return `${pairMatch[1]}/${pairMatch[2]}`.toUpperCase()
    }

    // Try to extract single symbols
    const symbolMatch = query.match(/\b([A-Z]{2,5})\b/i)
    if (symbolMatch) {
      return `${symbolMatch[1]}/USD`.toUpperCase()
    }

    return null
  }

  /**
   * Get historical price data
   */
  private async getHistoricalPriceData(
    feedId: string,
    hours: number
  ): Promise<any[]> {
    try {
      const response = await this.client.get(`/v1/feeds/${feedId}/historical`, {
        headers: this.getAuthHeaders(),
        params: this.buildQueryParams({
          hours: hours.toString(),
          interval: '1h'
        })
      })

      return response.data?.map((point: any) => 
        this.createDataPoint(
          point.price,
          `price_feed:${feedId}:historical`,
          ConfidenceLevel.HIGH,
          {
            timestamp: new Date(point.timestamp * 1000),
            round: point.round
          }
        )
      ) || []

    } catch (error) {
      console.warn(`Failed to fetch historical data for feed ${feedId}:`, error)
      return []
    }
  }

  /**
   * Build Chainlink Function source code
   */
  private buildFunctionSource(request: QueryRequest): string {
    // This would generate JavaScript code for Chainlink Functions
    return `
      const query = args[0];
      const response = await Functions.makeHttpRequest({
        url: 'https://api.example.com/data',
        method: 'GET',
        params: { q: query }
      });
      
      if (response.error) {
        throw new Error('HTTP request failed');
      }
      
      return Functions.encodeString(response.data.result);
    `
  }

  /**
   * Get available price feeds for a chain
   */
  async getAvailableFeeds(chainId?: ChainId): Promise<ChainlinkFeedInfo[]> {
    const targetChain = chainId || this.config.network.defaultChain
    
    if (!this.feedCache.has(`feeds:${targetChain}`)) {
      await this.loadFeedDirectory(targetChain)
    }
    
    return this.feedCache.get(`feeds:${targetChain}`) || []
  }

  /**
   * Get real-time price updates via WebSocket
   */
  subscribeToFeed(
    feedId: string,
    callback: (data: ChainlinkPriceFeed) => void
  ): WebSocket {
    const ws = this.client.createWebSocket(`wss://ws.chain.link/v1/feeds/${feedId}`)
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const feed: ChainlinkPriceFeed = {
          feedId,
          pair: data.pair,
          price: data.price,
          timestamp: new Date(data.timestamp * 1000),
          decimals: data.decimals,
          round: data.round,
          updatedAt: new Date()
        }
        callback(feed)
      } catch (error) {
        console.error('Error parsing Chainlink feed data:', error)
      }
    }

    return ws
  }
}