/**
 * OpenOracle Router - Intelligent routing to optimal oracle providers
 */

import { OracleConfig } from './config'
import { OracleClient } from './client'
import { 
  RoutingError, 
  ValidationError, 
  ProviderError, 
  ConsensusError,
  TimeoutError 
} from './exceptions'
import { 
  OracleProvider, 
  DataCategory, 
  RoutingStrategy, 
  ConfidenceLevel 
} from '../types/enums'
import {
  OracleRoutingRequest,
  OracleRoutingResponse,
  OracleDataPoint,
  AggregatedOracleData,
  ProviderCapabilities,
  RoutingMetrics,
  validateOracleRequest
} from '../schemas/oracle-schemas'

export interface RoutingOptions {
  strategy?: RoutingStrategy
  maxProviders?: number
  consensusThreshold?: number
  timeoutMs?: number
  enableCaching?: boolean
  fallbackEnabled?: boolean
}

export class OracleRouter {
  private readonly config: OracleConfig
  private readonly client: OracleClient
  private readonly providerMetrics: Map<OracleProvider, RoutingMetrics> = new Map()
  private readonly cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map()

  constructor(config: OracleConfig, client?: OracleClient) {
    this.config = config
    this.client = client || new OracleClient(config)
    this.initializeProviderMetrics()
  }

  private initializeProviderMetrics(): void {
    Object.values(OracleProvider).forEach(provider => {
      this.providerMetrics.set(provider, {
        providerId: provider,
        requestCount: 0,
        successCount: 0,
        errorCount: 0,
        averageResponseTime: 0,
        lastUsed: new Date(0),
        cost: 0,
        reliability: 1.0
      })
    })
  }

  /**
   * Route a question to the optimal oracle provider(s)
   */
  async routeQuestion(
    query: string,
    category: DataCategory,
    options: RoutingOptions = {}
  ): Promise<OracleRoutingResponse> {
    const request: OracleRoutingRequest = {
      query,
      category,
      maxProviders: options.maxProviders || this.config.routing.maxProviders,
      consensusThreshold: options.consensusThreshold || this.config.routing.consensusThreshold,
      timeoutMs: options.timeoutMs || this.config.network.timeouts.request,
      cacheEnabled: options.enableCaching ?? this.config.cache.strategy !== 'no_cache'
    }

    // Validate request
    const validation = validateOracleRequest(request)
    if (!validation.isValid) {
      throw new ValidationError(`Invalid routing request: ${validation.errors.join(', ')}`)
    }

    // Check cache first
    if (request.cacheEnabled) {
      const cached = this.getCachedResponse(request)
      if (cached) {
        return cached
      }
    }

    const startTime = Date.now()

    try {
      // Select optimal providers
      const selectedProviders = await this.selectProviders(request, options.strategy)
      
      if (selectedProviders.length === 0) {
        throw new RoutingError('No suitable providers found for the query')
      }

      // Execute queries
      const responses = await this.executeQueries(request, selectedProviders)
      
      // Aggregate results
      const aggregatedResult = this.aggregateResponses(responses, request)
      
      // Build final response
      const response: OracleRoutingResponse = {
        oracleProvider: aggregatedResult.primaryProvider,
        confidence: aggregatedResult.confidence,
        data: aggregatedResult.data,
        reasoning: aggregatedResult.reasoning,
        alternativeProviders: selectedProviders.filter(p => p !== aggregatedResult.primaryProvider),
        executionTimeMs: Date.now() - startTime,
        cached: false,
        metadata: {
          totalProviders: selectedProviders.length,
          consensus: aggregatedResult.consensus,
          strategy: options.strategy || this.config.routing.strategy
        }
      }

      // Cache the response
      if (request.cacheEnabled) {
        this.cacheResponse(request, response)
      }

      return response

    } catch (error) {
      if (options.fallbackEnabled && this.config.routing.fallbackProviders.length > 0) {
        return this.executeFallback(request, error as Error)
      }
      throw error
    }
  }

  /**
   * Select optimal providers based on routing strategy
   */
  private async selectProviders(
    request: OracleRoutingRequest,
    strategy?: RoutingStrategy
  ): Promise<OracleProvider[]> {
    const availableProviders = this.getAvailableProviders(request)
    const routingStrategy = strategy || this.config.routing.strategy

    switch (routingStrategy) {
      case RoutingStrategy.COST_OPTIMIZED:
        return this.selectByCost(availableProviders, request.maxProviders!)
      
      case RoutingStrategy.SPEED_OPTIMIZED:
        return this.selectBySpeed(availableProviders, request.maxProviders!)
      
      case RoutingStrategy.ACCURACY_OPTIMIZED:
        return this.selectByAccuracy(availableProviders, request.maxProviders!)
      
      case RoutingStrategy.REDUNDANT:
        return this.selectForRedundancy(availableProviders, request.maxProviders!)
      
      case RoutingStrategy.BALANCED:
      default:
        return this.selectBalanced(availableProviders, request.maxProviders!)
    }
  }

  private getAvailableProviders(request: OracleRoutingRequest): OracleProvider[] {
    let providers = Object.values(OracleProvider)

    // Filter by required providers
    if (request.requiredProviders && request.requiredProviders.length > 0) {
      providers = providers.filter(p => request.requiredProviders!.includes(p))
    }

    // Filter out excluded providers
    if (request.excludedProviders && request.excludedProviders.length > 0) {
      providers = providers.filter(p => !request.excludedProviders!.includes(p))
    }

    // Filter by provider availability and API keys
    return providers.filter(provider => {
      return this.config.hasApiKey(provider) || this.isPublicProvider(provider)
    })
  }

  private isPublicProvider(provider: OracleProvider): boolean {
    // Some providers like Pyth don't require API keys
    return [OracleProvider.PYTH].includes(provider)
  }

  private selectByCost(providers: OracleProvider[], maxProviders: number): OracleProvider[] {
    return providers
      .sort((a, b) => this.getProviderCost(a) - this.getProviderCost(b))
      .slice(0, maxProviders)
  }

  private selectBySpeed(providers: OracleProvider[], maxProviders: number): OracleProvider[] {
    return providers
      .sort((a, b) => {
        const metricsA = this.providerMetrics.get(a)!
        const metricsB = this.providerMetrics.get(b)!
        return metricsA.averageResponseTime - metricsB.averageResponseTime
      })
      .slice(0, maxProviders)
  }

  private selectByAccuracy(providers: OracleProvider[], maxProviders: number): OracleProvider[] {
    return providers
      .sort((a, b) => {
        const reliabilityA = this.providerMetrics.get(a)!.reliability
        const reliabilityB = this.providerMetrics.get(b)!.reliability
        return reliabilityB - reliabilityA
      })
      .slice(0, maxProviders)
  }

  private selectForRedundancy(providers: OracleProvider[], maxProviders: number): OracleProvider[] {
    // Select diverse providers for redundancy
    const priorityOrder = [
      OracleProvider.CHAINLINK,
      OracleProvider.PYTH,
      OracleProvider.UMA,
      OracleProvider.BAND,
      OracleProvider.API3
    ]
    
    return priorityOrder
      .filter(p => providers.includes(p))
      .slice(0, maxProviders)
  }

  private selectBalanced(providers: OracleProvider[], maxProviders: number): OracleProvider[] {
    // Weighted scoring based on configuration
    const scores = providers.map(provider => {
      const metrics = this.providerMetrics.get(provider)!
      const cost = this.getProviderCost(provider)
      
      const score = 
        (this.config.routing.speedWeighting * (1 / (metrics.averageResponseTime + 1))) +
        (this.config.routing.accuracyWeighting * metrics.reliability) +
        (this.config.routing.costWeighting * (1 / (cost + 1)))
      
      return { provider, score }
    })

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, maxProviders)
      .map(item => item.provider)
  }

  private getProviderCost(provider: OracleProvider): number {
    // Mock cost calculation - would be real costs in production
    const costs = {
      [OracleProvider.CHAINLINK]: 0.01,
      [OracleProvider.PYTH]: 0.005,
      [OracleProvider.UMA]: 0.02,
      [OracleProvider.BAND]: 0.015,
      [OracleProvider.API3]: 0.01
    } as Record<OracleProvider, number>

    return costs[provider] || 0.01
  }

  /**
   * Execute queries across selected providers
   */
  private async executeQueries(
    request: OracleRoutingRequest,
    providers: OracleProvider[]
  ): Promise<Array<{ provider: OracleProvider; data: OracleDataPoint[]; error?: Error }>> {
    const promises = providers.map(async (provider) => {
      const startTime = Date.now()
      
      try {
        const data = await this.queryProvider(provider, request)
        
        // Update metrics
        this.updateProviderMetrics(provider, {
          success: true,
          responseTime: Date.now() - startTime
        })
        
        return { provider, data }
      } catch (error) {
        // Update metrics
        this.updateProviderMetrics(provider, {
          success: false,
          responseTime: Date.now() - startTime
        })
        
        return { provider, data: [], error: error as Error }
      }
    })

    return Promise.all(promises)
  }

  private async queryProvider(
    provider: OracleProvider,
    request: OracleRoutingRequest
  ): Promise<OracleDataPoint[]> {
    try {
      const response = await this.client.post(`/api/oracle/${provider}/query`, {
        query: request.query,
        category: request.category,
        metadata: request.metadata
      })

      return response.data || []
    } catch (error) {
      throw new ProviderError(
        `Provider ${provider} query failed`,
        provider,
        { originalError: (error as Error).message }
      )
    }
  }

  private aggregateResponses(
    responses: Array<{ provider: OracleProvider; data: OracleDataPoint[]; error?: Error }>,
    request: OracleRoutingRequest
  ): {
    primaryProvider: OracleProvider
    confidence: ConfidenceLevel
    data: OracleDataPoint[]
    reasoning: string
    consensus: boolean
  } {
    const successfulResponses = responses.filter(r => !r.error && r.data.length > 0)
    
    if (successfulResponses.length === 0) {
      throw new RoutingError('All providers failed to return data')
    }

    // Simple aggregation - use first successful response as primary
    const primary = successfulResponses[0]
    
    // Check for consensus if multiple responses
    let consensus = true
    if (successfulResponses.length > 1) {
      consensus = this.checkConsensus(successfulResponses, request.consensusThreshold!)
    }

    const confidence = this.calculateConfidence(successfulResponses, consensus)
    
    return {
      primaryProvider: primary.provider,
      confidence,
      data: primary.data,
      reasoning: this.generateReasoning(successfulResponses, consensus),
      consensus
    }
  }

  private checkConsensus(
    responses: Array<{ provider: OracleProvider; data: OracleDataPoint[] }>,
    threshold: number
  ): boolean {
    // Simplified consensus check - compare first values
    if (responses.length < 2) return true

    const values = responses.map(r => r.data[0]?.value).filter(v => v !== undefined)
    if (values.length < 2) return true

    // For numeric values, check if they're within a reasonable range
    if (typeof values[0] === 'number') {
      const numValues = values as number[]
      const mean = numValues.reduce((a, b) => a + b, 0) / numValues.length
      const variance = numValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numValues.length
      const standardDeviation = Math.sqrt(variance)
      
      // Consider consensus if standard deviation is low relative to mean
      return (standardDeviation / Math.abs(mean)) < (1 - threshold)
    }

    // For non-numeric values, check exact matches
    const uniqueValues = new Set(values)
    return uniqueValues.size === 1
  }

  private calculateConfidence(
    responses: Array<{ provider: OracleProvider; data: OracleDataPoint[] }>,
    consensus: boolean
  ): ConfidenceLevel {
    if (responses.length === 0) return ConfidenceLevel.VERY_LOW
    
    if (responses.length === 1) {
      const reliability = this.providerMetrics.get(responses[0].provider)!.reliability
      if (reliability > 0.9) return ConfidenceLevel.HIGH
      if (reliability > 0.7) return ConfidenceLevel.MEDIUM
      return ConfidenceLevel.LOW
    }

    if (consensus) {
      return responses.length >= 3 ? ConfidenceLevel.VERY_HIGH : ConfidenceLevel.HIGH
    }

    return ConfidenceLevel.MEDIUM
  }

  private generateReasoning(
    responses: Array<{ provider: OracleProvider; data: OracleDataPoint[] }>,
    consensus: boolean
  ): string {
    const providerNames = responses.map(r => r.provider).join(', ')
    
    if (responses.length === 1) {
      return `Single provider response from ${providerNames}`
    }

    if (consensus) {
      return `Consensus achieved across ${responses.length} providers: ${providerNames}`
    }

    return `Mixed results from ${responses.length} providers: ${providerNames}. Using primary provider result.`
  }

  private async executeFallback(
    request: OracleRoutingRequest,
    originalError: Error
  ): Promise<OracleRoutingResponse> {
    const fallbackProviders = this.config.routing.fallbackProviders
    
    try {
      const responses = await this.executeQueries(request, fallbackProviders)
      const aggregated = this.aggregateResponses(responses, request)
      
      return {
        oracleProvider: aggregated.primaryProvider,
        confidence: ConfidenceLevel.LOW, // Fallback always has lower confidence
        data: aggregated.data,
        reasoning: `Fallback execution after primary failure: ${originalError.message}`,
        alternativeProviders: [],
        executionTimeMs: 0,
        cached: false,
        metadata: { fallback: true, originalError: originalError.message }
      }
    } catch (fallbackError) {
      throw new RoutingError(
        `Both primary and fallback routing failed`,
        { 
          originalError: originalError.message,
          fallbackError: (fallbackError as Error).message
        }
      )
    }
  }

  private updateProviderMetrics(
    provider: OracleProvider,
    result: { success: boolean; responseTime: number }
  ): void {
    const metrics = this.providerMetrics.get(provider)!
    
    metrics.requestCount++
    metrics.lastUsed = new Date()
    
    if (result.success) {
      metrics.successCount++
    } else {
      metrics.errorCount++
    }
    
    // Update average response time
    metrics.averageResponseTime = (
      (metrics.averageResponseTime * (metrics.requestCount - 1) + result.responseTime) /
      metrics.requestCount
    )
    
    // Update reliability
    metrics.reliability = metrics.successCount / metrics.requestCount
  }

  private getCachedResponse(request: OracleRoutingRequest): OracleRoutingResponse | null {
    const key = this.getCacheKey(request)
    const cached = this.cache.get(key)
    
    if (!cached) return null
    
    const now = Date.now()
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key)
      return null
    }
    
    return { ...cached.data, cached: true }
  }

  private cacheResponse(request: OracleRoutingRequest, response: OracleRoutingResponse): void {
    const key = this.getCacheKey(request)
    this.cache.set(key, {
      data: response,
      timestamp: Date.now(),
      ttl: this.config.cache.ttlSeconds * 1000
    })
    
    // Clean up old entries if cache is too large
    if (this.cache.size > this.config.cache.maxSize) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }
  }

  private getCacheKey(request: OracleRoutingRequest): string {
    return `${request.query}:${request.category}:${JSON.stringify(request.metadata || {})}`
  }

  /**
   * Get routing metrics for all providers
   */
  getMetrics(): Map<OracleProvider, RoutingMetrics> {
    return new Map(this.providerMetrics)
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Health check for all configured providers
   */
  async healthCheck(): Promise<Record<OracleProvider, boolean>> {
    const providers = Object.values(OracleProvider)
    const results: Record<OracleProvider, boolean> = {} as any
    
    await Promise.all(
      providers.map(async (provider) => {
        try {
          await this.client.get(`/api/oracle/${provider}/health`)
          results[provider] = true
        } catch {
          results[provider] = false
        }
      })
    )
    
    return results
  }
}