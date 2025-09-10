/**
 * Pyth Oracle Provider
 */

import { BaseOracleProvider, QueryRequest, QueryResponse, ProviderOptions } from './base'
import { OracleConfig } from '../core/config'
import { OracleClient } from '../core/client'
import { 
  OracleProvider, 
  DataCategory, 
  OracleCapability,
  ConfidenceLevel 
} from '../types/enums'
import { 
  ProviderConfiguration,
  PythPriceFeed 
} from '../schemas/oracle-schemas'
import { ProviderError, ValidationError } from '../core/exceptions'

export interface PythQueryOptions extends ProviderOptions {
  priceId?: string
  includeConfidence?: boolean
  maxStaleness?: number
  binary?: boolean
}

export interface PythFeedInfo {
  id: string
  symbol: string
  assetType: string
  base: string
  quote: string
  description: string
  genericSymbol?: string
}

export interface PythPriceUpdate {
  id: string
  price: {
    price: string
    conf: string
    expo: number
    publishTime: number
  }
  emaPrice: {
    price: string
    conf: string
    expo: number
    publishTime: number
  }
}

export class PythProvider extends BaseOracleProvider {
  private readonly hermesEndpoint = 'https://hermes.pyth.network'
  private readonly feedCache = new Map<string, PythFeedInfo[]>()
  private lastFeedUpdate = 0
  private readonly FEED_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  constructor(
    config: OracleConfig,
    client: OracleClient,
    providerConfig: ProviderConfiguration
  ) {
    super(config, client, providerConfig)
  }

  getProviderName(): OracleProvider {
    return OracleProvider.PYTH
  }

  getProviderCapabilities(): OracleCapability[] {
    return [
      OracleCapability.PRICE_FEEDS
    ]
  }

  getSupportedCategories(): DataCategory[] {
    return [
      DataCategory.PRICE,
      DataCategory.CRYPTO,
      DataCategory.STOCKS,
      DataCategory.FOREX,
      DataCategory.COMMODITIES
    ]
  }

  getEndpointUrl(): string {
    return this.providerConfig.endpointUrl || this.hermesEndpoint
  }

  protected getCostPerQuery(): number {
    return 0.005 // $0.005 per query (cheaper than Chainlink)
  }

  async queryData(request: QueryRequest, options: PythQueryOptions = {}): Promise<QueryResponse> {
    const startTime = Date.now()

    try {
      switch (request.category) {
        case DataCategory.PRICE:
        case DataCategory.CRYPTO:
        case DataCategory.STOCKS:
        case DataCategory.FOREX:
        case DataCategory.COMMODITIES:
          return await this.queryPriceData(request, options)
        
        default:
          throw new ValidationError(`Category ${request.category} not supported by Pyth`)
      }
    } catch (error) {
      throw this.createProviderError(
        `Pyth query failed: ${error instanceof Error ? error.message : String(error)}`,
        error as Error
      )
    }
  }

  /**
   * Query price data from Pyth Network
   */
  private async queryPriceData(
    request: QueryRequest,
    options: PythQueryOptions
  ): Promise<QueryResponse> {
    const startTime = Date.now()

    // Extract symbol from query
    const symbol = this.extractSymbol(request.query)
    if (!symbol) {
      throw new ValidationError('Could not extract trading pair from query')
    }

    // Find appropriate price feed
    const feedInfo = await this.findPriceFeed(symbol)
    if (!feedInfo) {
      throw new ProviderError(`No Pyth price feed found for ${symbol}`, this.getProviderName())
    }

    try {
      // Get latest price data
      const endpoint = options.binary ? '/api/latest_vaas' : '/v2/updates/price/latest'
      const response = await this.client.get(endpoint, {
        params: this.buildQueryParams({
          ids: feedInfo.id,
          ...(options.binary && { 
            encoding: 'base64',
            parsed: true 
          })
        }),
        baseURL: this.getEndpointUrl()
      })

      const priceData = options.binary ? response.data[0] : response.parsed[0]
      
      const feed: PythPriceFeed = {
        priceId: feedInfo.id,
        symbol: feedInfo.symbol,
        price: this.parsePythPrice(priceData.price),
        confidence: this.parsePythPrice(priceData.price, true), // confidence interval
        timestamp: new Date(priceData.price.publishTime * 1000),
        status: this.getPriceStatus(priceData.price),
        previousPrice: priceData.emaPrice ? this.parsePythPrice(priceData.emaPrice) : undefined,
        previousTimestamp: priceData.emaPrice ? new Date(priceData.emaPrice.publishTime * 1000) : undefined
      }

      const dataPoints = [
        this.createDataPoint(
          feed.price,
          `price_feed:${feedInfo.id}`,
          this.calculateConfidence(feed),
          {
            symbol: feed.symbol,
            priceId: feed.priceId,
            confidence: feed.confidence,
            status: feed.status,
            publishTime: feed.timestamp,
            assetType: feedInfo.assetType,
            base: feedInfo.base,
            quote: feedInfo.quote
          }
        )
      ]

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
   * Find price feed for a given symbol
   */
  private async findPriceFeed(symbol: string): Promise<PythFeedInfo | null> {
    // Load feeds if cache is empty or stale
    if (!this.feedCache.has('all') || Date.now() - this.lastFeedUpdate > this.FEED_CACHE_TTL) {
      await this.loadFeedDirectory()
    }

    const feeds = this.feedCache.get('all') || []
    
    // Find exact match first
    let feed = feeds.find(f => 
      f.symbol.toLowerCase() === symbol.toLowerCase() ||
      f.genericSymbol?.toLowerCase() === symbol.toLowerCase() ||
      `${f.base}/${f.quote}`.toLowerCase() === symbol.toLowerCase()
    )

    // If no exact match, try partial matches
    if (!feed) {
      const normalizedSymbol = symbol.toLowerCase().replace(/[\s\/\-]/g, '')
      feed = feeds.find(f => {
        const feedSymbol = f.symbol.toLowerCase().replace(/[\s\/\-]/g, '')
        const feedPair = `${f.base}${f.quote}`.toLowerCase()
        return feedSymbol.includes(normalizedSymbol) || feedPair.includes(normalizedSymbol)
      })
    }

    return feed || null
  }

  /**
   * Load price feed directory from Pyth
   */
  private async loadFeedDirectory(): Promise<void> {
    try {
      const response = await this.client.get('/v2/price_feeds', {
        baseURL: this.getEndpointUrl(),
        params: { 
          query: '',
          asset_type: 'crypto,equity,fx,commodities'
        }
      })

      const feeds: PythFeedInfo[] = response.data?.map((feed: any) => ({
        id: feed.id,
        symbol: feed.attributes?.symbol || '',
        assetType: feed.attributes?.asset_type || '',
        base: feed.attributes?.base || '',
        quote: feed.attributes?.quote_currency || '',
        description: feed.attributes?.description || '',
        genericSymbol: feed.attributes?.generic_symbol
      })) || []

      this.feedCache.set('all', feeds)
      this.lastFeedUpdate = Date.now()

    } catch (error) {
      console.warn('Failed to load Pyth feed directory:', error)
      // Use empty array as fallback
      this.feedCache.set('all', [])
      this.lastFeedUpdate = Date.now()
    }
  }

  /**
   * Parse Pyth price format
   */
  private parsePythPrice(priceData: any, isConfidence: boolean = false): number {
    const value = isConfidence ? priceData.conf : priceData.price
    const expo = priceData.expo
    
    return parseFloat(value) * Math.pow(10, expo)
  }

  /**
   * Get price status from Pyth data
   */
  private getPriceStatus(priceData: any): 'trading' | 'halted' | 'auction' {
    // Pyth doesn't explicitly provide status, infer from data freshness
    const now = Date.now() / 1000
    const publishTime = priceData.publishTime
    const staleness = now - publishTime

    if (staleness > 300) { // 5 minutes
      return 'halted'
    } else if (staleness > 60) { // 1 minute
      return 'auction'
    }
    
    return 'trading'
  }

  /**
   * Calculate confidence level based on Pyth confidence interval
   */
  private calculateConfidence(feed: PythPriceFeed): ConfidenceLevel {
    if (!feed.confidence || feed.confidence === 0) {
      return ConfidenceLevel.MEDIUM
    }

    const confidenceRatio = feed.confidence / Math.abs(feed.price)
    
    if (confidenceRatio < 0.001) { // Less than 0.1%
      return ConfidenceLevel.VERY_HIGH
    } else if (confidenceRatio < 0.005) { // Less than 0.5%
      return ConfidenceLevel.HIGH
    } else if (confidenceRatio < 0.02) { // Less than 2%
      return ConfidenceLevel.MEDIUM
    } else if (confidenceRatio < 0.05) { // Less than 5%
      return ConfidenceLevel.LOW
    } else {
      return ConfidenceLevel.VERY_LOW
    }
  }

  /**
   * Extract trading symbol from query
   */
  private extractSymbol(query: string): string | null {
    // Try to extract trading pairs like "BTC/USD", "ETH/USD", etc.
    const pairMatch = query.match(/([A-Z]{2,10})[\/\-\s]([A-Z]{2,10})/i)
    if (pairMatch) {
      return `${pairMatch[1]}/${pairMatch[2]}`.toUpperCase()
    }

    // Try to extract single symbols
    const symbolMatch = query.match(/\b([A-Z]{2,10})\b/i)
    if (symbolMatch) {
      const symbol = symbolMatch[1].toUpperCase()
      // For crypto, default to USD pair
      if (['BTC', 'ETH', 'ADA', 'SOL', 'AVAX', 'MATIC', 'DOT', 'LINK'].includes(symbol)) {
        return `${symbol}/USD`
      }
      return symbol
    }

    return null
  }

  /**
   * Get available price feeds
   */
  async getAvailableFeeds(): Promise<PythFeedInfo[]> {
    if (!this.feedCache.has('all') || Date.now() - this.lastFeedUpdate > this.FEED_CACHE_TTL) {
      await this.loadFeedDirectory()
    }
    
    return this.feedCache.get('all') || []
  }

  /**
   * Get multiple price feeds at once
   */
  async getBatchPrices(priceIds: string[]): Promise<PythPriceFeed[]> {
    if (priceIds.length === 0) {
      return []
    }

    try {
      const response = await this.client.get('/v2/updates/price/latest', {
        params: {
          ids: priceIds.join(',')
        },
        baseURL: this.getEndpointUrl()
      })

      return response.parsed?.map((priceData: any, index: number) => ({
        priceId: priceIds[index],
        symbol: '', // Would need to map back from priceId
        price: this.parsePythPrice(priceData.price),
        confidence: this.parsePythPrice(priceData.price, true),
        timestamp: new Date(priceData.price.publishTime * 1000),
        status: this.getPriceStatus(priceData.price),
        previousPrice: priceData.emaPrice ? this.parsePythPrice(priceData.emaPrice) : undefined,
        previousTimestamp: priceData.emaPrice ? new Date(priceData.emaPrice.publishTime * 1000) : undefined
      })) || []

    } catch (error) {
      throw this.createProviderError(
        'Failed to fetch batch price data',
        error as Error
      )
    }
  }

  /**
   * Get historical price data
   */
  async getHistoricalPrices(
    priceId: string,
    startTime: Date,
    endTime: Date
  ): Promise<PythPriceFeed[]> {
    try {
      const response = await this.client.get('/v2/updates/price', {
        params: {
          ids: priceId,
          start_time: Math.floor(startTime.getTime() / 1000),
          end_time: Math.floor(endTime.getTime() / 1000)
        },
        baseURL: this.getEndpointUrl()
      })

      return response.parsed?.map((priceData: any) => ({
        priceId,
        symbol: '',
        price: this.parsePythPrice(priceData.price),
        confidence: this.parsePythPrice(priceData.price, true),
        timestamp: new Date(priceData.price.publishTime * 1000),
        status: this.getPriceStatus(priceData.price)
      })) || []

    } catch (error) {
      throw this.createProviderError(
        'Failed to fetch historical price data',
        error as Error
      )
    }
  }

  /**
   * Subscribe to real-time price updates
   */
  subscribeToPrice(
    priceId: string,
    callback: (data: PythPriceFeed) => void
  ): WebSocket {
    const ws = this.client.createWebSocket(`wss://hermes.pyth.network/ws`)
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'subscribe',
        ids: [priceId]
      }))
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'price_update') {
          const priceData = data.price_feed
          const feed: PythPriceFeed = {
            priceId,
            symbol: '',
            price: this.parsePythPrice(priceData.price),
            confidence: this.parsePythPrice(priceData.price, true),
            timestamp: new Date(priceData.price.publishTime * 1000),
            status: this.getPriceStatus(priceData.price)
          }
          callback(feed)
        }
      } catch (error) {
        console.error('Error parsing Pyth price update:', error)
      }
    }

    return ws
  }

  /**
   * Get price feed metadata
   */
  async getFeedMetadata(priceId: string): Promise<PythFeedInfo | null> {
    const feeds = await this.getAvailableFeeds()
    return feeds.find(f => f.id === priceId) || null
  }

  /**
   * Search feeds by asset type
   */
  async searchFeedsByAssetType(assetType: 'crypto' | 'equity' | 'fx' | 'commodities'): Promise<PythFeedInfo[]> {
    const feeds = await this.getAvailableFeeds()
    return feeds.filter(f => f.assetType === assetType)
  }
}