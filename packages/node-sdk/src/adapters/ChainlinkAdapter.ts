/**
 * Chainlink Oracle Adapter for OpenOracle Protocol (Node.js/TypeScript)
 * 
 * Provides integration with Chainlink's decentralized oracle network
 * for price feeds and other data sources.
 */

import axios, { AxiosResponse } from 'axios'
import { BaseOracleAdapter, OracleRequest, DataType, AdapterConfig } from './BaseOracleAdapter'

export interface ChainlinkConfig extends AdapterConfig {
  apiKey?: string
  baseUrl?: string
  network?: 'mainnet' | 'testnet'
}

/**
 * Chainlink oracle adapter for price feeds and market data.
 * 
 * Usage:
 * ```typescript
 * const adapter = new ChainlinkAdapter({
 *   apiKey: 'your-chainlink-api-key',
 *   baseUrl: 'https://api.chain.link/v1'
 * })
 * 
 * const response = await adapter.query({
 *   query: 'BTC/USD',
 *   dataType: DataType.PRICE
 * })
 * ```
 */
export class ChainlinkAdapter extends BaseOracleAdapter {
  
  constructor(config: ChainlinkConfig) {
    super(config)
  }

  protected getAdapterName(): string {
    return 'chainlink'
  }

  protected getAdapterVersion(): string {
    return '1.0.0'
  }

  protected getSupportedDataTypes(): DataType[] {
    return [DataType.PRICE, DataType.WEATHER, DataType.SPORTS]
  }

  protected async executeQuery(request: OracleRequest): Promise<any> {
    switch (request.dataType) {
      case DataType.PRICE:
        return this.getPriceFeed(request.query)
      case DataType.WEATHER:
        return this.getWeatherData(request.query)
      case DataType.SPORTS:
        return this.getSportsData(request.query)
      default:
        throw new Error(`Unsupported data type: ${request.dataType}`)
    }
  }

  /**
   * Get price feed from Chainlink
   */
  private async getPriceFeed(pair: string): Promise<any> {
    const baseUrl = this.config.baseUrl || 'https://api.chain.link/v1'
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }

    try {
      const response: AxiosResponse = await axios.get(
        `${baseUrl}/price/${pair}`,
        { headers }
      )

      return {
        price: parseFloat(response.data.price),
        pair,
        decimals: response.data.decimals || 8,
        updatedAt: response.data.updatedAt,
        roundId: response.data.roundId,
        source: 'chainlink'
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Chainlink API error: ${error.response?.status} ${error.response?.statusText}`)
      }
      throw error
    }
  }

  /**
   * Get weather data from Chainlink (example implementation)
   */
  private async getWeatherData(location: string): Promise<any> {
    // Example implementation - replace with actual Chainlink weather oracle
    const baseUrl = this.config.baseUrl || 'https://api.chain.link/v1'
    
    // Mock implementation for demonstration
    return {
      location,
      temperature: 22.5,
      humidity: 65,
      description: 'Partly cloudy',
      source: 'chainlink-weather',
      timestamp: Date.now()
    }
  }

  /**
   * Get sports data from Chainlink (example implementation)
   */
  private async getSportsData(event: string): Promise<any> {
    // Example implementation - replace with actual Chainlink sports oracle
    return {
      event,
      status: 'completed',
      score: { home: 2, away: 1 },
      source: 'chainlink-sports',
      timestamp: Date.now()
    }
  }

  protected calculateConfidence(data: any, request: OracleRequest): number {
    if (!data) return 0.0

    // Higher confidence for recent price updates
    if (data.updatedAt) {
      const ageSeconds = (Date.now() - data.updatedAt) / 1000
      if (ageSeconds < 60) return 0.95      // Less than 1 minute old
      if (ageSeconds < 300) return 0.85     // Less than 5 minutes old
      return 0.75                           // Older data
    }

    return 0.8 // Default confidence
  }

  protected calculateCost(request: OracleRequest): number {
    // Chainlink pricing model (example)
    const pricing: Record<DataType, number> = {
      [DataType.PRICE]: 0.001,    // $0.001 per price query
      [DataType.WEATHER]: 0.005,  // $0.005 per weather query
      [DataType.SPORTS]: 0.005,   // $0.005 per sports query
      [DataType.CUSTOM]: 0.01,
      [DataType.NEWS]: 0.01,
      [DataType.SOCIAL]: 0.01
    }

    return pricing[request.dataType] || 0.01
  }

  protected getResponseMetadata(request: OracleRequest): Record<string, any> {
    return {
      provider: 'chainlink',
      network: this.config.network || 'mainnet',
      version: this.version
    }
  }

  protected async healthCheckQuery(): Promise<any> {
    // Simple health check using ETH/USD price feed
    return this.getPriceFeed('ETH/USD')
  }
}