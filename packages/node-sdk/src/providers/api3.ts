/**
 * API3 Oracle Provider
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
import { ProviderConfiguration } from '../schemas/oracle-schemas'

export class API3Provider extends BaseOracleProvider {
  constructor(
    config: OracleConfig,
    client: OracleClient,
    providerConfig: ProviderConfiguration
  ) {
    super(config, client, providerConfig)
  }

  getProviderName(): OracleProvider {
    return OracleProvider.API3
  }

  getProviderCapabilities(): OracleCapability[] {
    return [
      OracleCapability.PRICE_FEEDS,
      OracleCapability.EXTERNAL_ADAPTERS
    ]
  }

  getSupportedCategories(): DataCategory[] {
    return [
      DataCategory.PRICE,
      DataCategory.CRYPTO,
      DataCategory.STOCKS,
      DataCategory.ECONOMIC
    ]
  }

  getEndpointUrl(): string {
    return this.providerConfig.endpointUrl || 'https://api.api3.org'
  }

  protected getCostPerQuery(): number {
    return 0.01
  }

  async queryData(request: QueryRequest, options: ProviderOptions = {}): Promise<QueryResponse> {
    const startTime = Date.now()

    try {
      const response = await this.client.get('/v1/dapis', {
        params: {
          symbol: this.extractSymbol(request.query)
        },
        headers: this.getAuthHeaders(),
        baseURL: this.getEndpointUrl()
      })

      const dataPoints = [
        this.createDataPoint(
          response.value,
          'api3_dapi',
          ConfidenceLevel.HIGH,
          {
            symbol: response.symbol,
            timestamp: response.timestamp,
            dapiId: response.dapiId
          }
        )
      ]

      return this.normalizeResponse(dataPoints, request, Date.now() - startTime)

    } catch (error) {
      throw this.createProviderError(
        `API3 query failed: ${error instanceof Error ? error.message : String(error)}`,
        error as Error
      )
    }
  }

  private extractSymbol(query: string): string {
    const match = query.match(/([A-Z]{2,5})/i)
    return match ? match[1].toUpperCase() : 'BTC'
  }
}