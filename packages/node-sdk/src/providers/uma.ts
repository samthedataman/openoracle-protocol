/**
 * UMA Oracle Provider - Optimistic Oracle for arbitrary data
 */

import { BaseOracleProvider, QueryRequest, QueryResponse, ProviderOptions } from './base'
import { OracleConfig } from '../core/config'
import { OracleClient } from '../core/client'
import { 
  OracleProvider, 
  DataCategory, 
  OracleCapability,
  ConfidenceLevel,
  ResolutionMethod 
} from '../types/enums'
import { ProviderConfiguration } from '../schemas/oracle-schemas'

export interface UMAQueryOptions extends ProviderOptions {
  bondAmount?: string
  disputeWindow?: number
  resolutionSource?: string
}

export class UMAProvider extends BaseOracleProvider {
  constructor(
    config: OracleConfig,
    client: OracleClient,
    providerConfig: ProviderConfiguration
  ) {
    super(config, client, providerConfig)
  }

  getProviderName(): OracleProvider {
    return OracleProvider.UMA
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
      DataCategory.SPORTS,
      DataCategory.ECONOMIC,
      DataCategory.NEWS,
      DataCategory.CUSTOM
    ]
  }

  getEndpointUrl(): string {
    return this.providerConfig.endpointUrl || 'https://api.umaproject.org'
  }

  protected getCostPerQuery(): number {
    return 0.02 // Higher cost due to optimistic nature
  }

  async queryData(request: QueryRequest, options: UMAQueryOptions = {}): Promise<QueryResponse> {
    const startTime = Date.now()

    try {
      // UMA queries are typically resolved through optimistic oracle
      const response = await this.client.post('/v1/request', {
        identifier: this.encodeIdentifier(request.query),
        ancillaryData: request.metadata,
        timestamp: Math.floor(Date.now() / 1000),
        bond: options.bondAmount || '1000000000000000000', // 1 ETH default
        disputeWindow: options.disputeWindow || 7200 // 2 hours
      }, {
        headers: this.getAuthHeaders(),
        baseURL: this.getEndpointUrl()
      })

      const dataPoints = [
        this.createDataPoint(
          response.proposedPrice || 'pending',
          'optimistic_oracle',
          ConfidenceLevel.MEDIUM,
          {
            requestId: response.requestId,
            proposer: response.proposer,
            bondAmount: options.bondAmount,
            expirationTime: response.expirationTime,
            disputed: response.disputed || false
          }
        )
      ]

      return this.normalizeResponse(dataPoints, request, Date.now() - startTime)

    } catch (error) {
      throw this.createProviderError(
        `UMA query failed: ${error instanceof Error ? error.message : String(error)}`,
        error as Error
      )
    }
  }

  private encodeIdentifier(query: string): string {
    // Convert query to UMA identifier format
    return query.replace(/\s+/g, '_').toUpperCase()
  }
}