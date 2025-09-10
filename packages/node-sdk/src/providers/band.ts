/**
 * Band Protocol Oracle Provider
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

export class BandProvider extends BaseOracleProvider {
  constructor(
    config: OracleConfig,
    client: OracleClient,
    providerConfig: ProviderConfiguration
  ) {
    super(config, client, providerConfig)
  }

  getProviderName(): OracleProvider {
    return OracleProvider.BAND
  }

  getProviderCapabilities(): OracleCapability[] {
    return [
      OracleCapability.PRICE_FEEDS,
      OracleCapability.SPORTS_DATA,
      OracleCapability.ECONOMIC_DATA
    ]
  }

  getSupportedCategories(): DataCategory[] {
    return [
      DataCategory.PRICE,
      DataCategory.CRYPTO,
      DataCategory.SPORTS,
      DataCategory.ECONOMIC
    ]
  }

  getEndpointUrl(): string {
    return this.providerConfig.endpointUrl || 'https://laozi1.bandchain.org/api'
  }

  protected getCostPerQuery(): number {
    return 0.015
  }

  async queryData(request: QueryRequest, options: ProviderOptions = {}): Promise<QueryResponse> {
    const startTime = Date.now()

    try {
      const response = await this.client.get('/oracle/v1/request_search', {
        params: {
          oid: 1, // Standard price oracle
          symbols: this.extractSymbol(request.query),
          min_count: 3,
          ask_count: 4
        },
        baseURL: this.getEndpointUrl()
      })

      const dataPoints = response.result?.map((item: any) => 
        this.createDataPoint(
          item.px,
          'band_protocol',
          ConfidenceLevel.HIGH,
          {
            symbol: item.symbol,
            timestamp: item.resolve_time,
            requestId: item.request_id
          }
        )
      ) || []

      return this.normalizeResponse(dataPoints, request, Date.now() - startTime)

    } catch (error) {
      throw this.createProviderError(
        `Band Protocol query failed: ${error instanceof Error ? error.message : String(error)}`,
        error as Error
      )
    }
  }

  private extractSymbol(query: string): string {
    const match = query.match(/([A-Z]{2,5})/i)
    return match ? match[1].toUpperCase() : 'BTC'
  }
}