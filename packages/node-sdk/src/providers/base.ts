/**
 * Base Oracle Provider - Abstract base class for all oracle providers
 */

import { OracleConfig } from '../core/config'
import { OracleClient } from '../core/client'
import { 
  OracleProvider, 
  DataCategory, 
  UpdateFrequency, 
  OracleCapability,
  ConfidenceLevel 
} from '../types/enums'
import {
  OracleDataPoint,
  ProviderCapabilities,
  ProviderConfiguration,
  validateProviderConfiguration
} from '../schemas/oracle-schemas'
import { ProviderError, ValidationError, TimeoutError } from '../core/exceptions'

export interface ProviderOptions {
  timeout?: number
  retryAttempts?: number
  cache?: boolean
  rateLimit?: number
}

export interface QueryRequest {
  query: string
  category: DataCategory
  parameters?: Record<string, any>
  metadata?: Record<string, any>
}

export interface QueryResponse {
  data: OracleDataPoint[]
  metadata: {
    provider: OracleProvider
    responseTime: number
    cached: boolean
    confidence: ConfidenceLevel
    cost?: number
  }
}

export abstract class BaseOracleProvider {
  protected readonly config: OracleConfig
  protected readonly client: OracleClient
  protected readonly providerConfig: ProviderConfiguration
  protected readonly capabilities: OracleCapability[]
  protected readonly supportedCategories: DataCategory[]
  
  private requestCount = 0
  private lastRequestTime = 0
  private readonly rateLimitQueue: Array<() => void> = []

  constructor(
    config: OracleConfig,
    client: OracleClient,
    providerConfig: ProviderConfiguration
  ) {
    this.config = config
    this.client = client
    this.providerConfig = providerConfig
    this.capabilities = this.getProviderCapabilities()
    this.supportedCategories = this.getSupportedCategories()
    
    this.validateConfiguration()
  }

  // Abstract methods that must be implemented by specific providers
  abstract getProviderName(): OracleProvider
  abstract getProviderCapabilities(): OracleCapability[]
  abstract getSupportedCategories(): DataCategory[]
  abstract queryData(request: QueryRequest, options?: ProviderOptions): Promise<QueryResponse>
  abstract getEndpointUrl(): string

  // Optional methods that can be overridden
  protected getDefaultTimeout(): number {
    return this.providerConfig.timeout || 30000
  }

  protected getDefaultRetries(): number {
    return this.providerConfig.retryAttempts || 3
  }

  protected getCostPerQuery(): number {
    return 0.01 // Default cost, override in specific providers
  }

  /**
   * Main query method with built-in retries, rate limiting, and error handling
   */
  async query(
    request: QueryRequest, 
    options: ProviderOptions = {}
  ): Promise<QueryResponse> {
    this.validateRequest(request)
    
    // Check if category is supported
    if (!this.supportedCategories.includes(request.category)) {
      throw new ProviderError(
        `Category ${request.category} is not supported by ${this.getProviderName()}`,
        this.getProviderName()
      )
    }

    // Apply rate limiting
    await this.applyRateLimit()

    const startTime = Date.now()
    const maxRetries = options.retryAttempts ?? this.getDefaultRetries()
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.executeQueryWithTimeout(request, options)
        
        // Update request metrics
        this.updateMetrics(true, Date.now() - startTime)
        
        return response
      } catch (error) {
        if (attempt === maxRetries) {
          this.updateMetrics(false, Date.now() - startTime)
          throw error
        }
        
        // Don't retry on validation errors
        if (error instanceof ValidationError) {
          throw error
        }
        
        // Wait before retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw new ProviderError(`All retry attempts failed for ${this.getProviderName()}`, this.getProviderName())
  }

  /**
   * Execute query with timeout protection
   */
  private async executeQueryWithTimeout(
    request: QueryRequest,
    options: ProviderOptions
  ): Promise<QueryResponse> {
    const timeout = options.timeout ?? this.getDefaultTimeout()
    
    return Promise.race([
      this.queryData(request, options),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new TimeoutError(`Query timeout after ${timeout}ms`, timeout)),
          timeout
        )
      })
    ])
  }

  /**
   * Health check for the provider
   */
  async healthCheck(): Promise<boolean> {
    try {
      const testRequest: QueryRequest = {
        query: 'health_check',
        category: DataCategory.CUSTOM
      }
      await this.query(testRequest, { timeout: 5000 })
      return true
    } catch {
      return false
    }
  }

  /**
   * Get provider capabilities information
   */
  getCapabilities(): ProviderCapabilities {
    return {
      provider: this.getProviderName(),
      capabilities: this.capabilities,
      supportedCategories: this.supportedCategories,
      updateFrequencies: this.getSupportedUpdateFrequencies(),
      costPerQuery: this.getCostPerQuery(),
      averageResponseTimeMs: this.getAverageResponseTime(),
      reliability: this.getReliability(),
      accuracy: this.getAccuracy()
    }
  }

  /**
   * Get supported update frequencies
   */
  protected getSupportedUpdateFrequencies(): UpdateFrequency[] {
    return [
      UpdateFrequency.ON_DEMAND,
      UpdateFrequency.MINUTE,
      UpdateFrequency.HOUR,
      UpdateFrequency.DAILY
    ]
  }

  /**
   * Get provider statistics
   */
  getStats(): {
    requestCount: number
    lastRequestTime: number
    averageResponseTime: number
    reliability: number
  } {
    return {
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
      averageResponseTime: this.getAverageResponseTime(),
      reliability: this.getReliability()
    }
  }

  /**
   * Test provider connectivity
   */
  async testConnection(): Promise<{
    connected: boolean
    responseTime?: number
    error?: string
  }> {
    const startTime = Date.now()
    
    try {
      const response = await this.client.get(this.getEndpointUrl(), {
        timeout: 5000
      })
      
      return {
        connected: true,
        responseTime: Date.now() - startTime
      }
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Create standardized oracle data point
   */
  protected createDataPoint(
    value: any,
    source: string,
    confidence: ConfidenceLevel = ConfidenceLevel.MEDIUM,
    metadata?: Record<string, any>
  ): OracleDataPoint {
    return {
      value,
      timestamp: new Date(),
      source: `${this.getProviderName()}:${source}`,
      confidence,
      metadata: {
        provider: this.getProviderName(),
        ...metadata
      }
    }
  }

  /**
   * Parse and normalize response data
   */
  protected normalizeResponse(
    rawData: any,
    request: QueryRequest,
    responseTime: number,
    cached: boolean = false
  ): QueryResponse {
    // This should be overridden by specific providers
    const dataPoints = Array.isArray(rawData) ? rawData : [rawData]
    
    return {
      data: dataPoints.map(item => 
        this.createDataPoint(item, 'api', ConfidenceLevel.MEDIUM)
      ),
      metadata: {
        provider: this.getProviderName(),
        responseTime,
        cached,
        confidence: ConfidenceLevel.MEDIUM,
        cost: this.getCostPerQuery()
      }
    }
  }

  /**
   * Validate request before processing
   */
  private validateRequest(request: QueryRequest): void {
    if (!request.query || request.query.trim().length === 0) {
      throw new ValidationError('Query cannot be empty')
    }

    if (!Object.values(DataCategory).includes(request.category)) {
      throw new ValidationError('Invalid data category')
    }
  }

  /**
   * Validate provider configuration
   */
  private validateConfiguration(): void {
    const validation = validateProviderConfiguration(this.providerConfig)
    if (!validation.isValid) {
      throw new ValidationError(
        `Invalid provider configuration: ${validation.errors.join(', ')}`
      )
    }
  }

  /**
   * Apply rate limiting
   */
  private async applyRateLimit(): Promise<void> {
    if (!this.providerConfig.rateLimit) return

    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    const minInterval = (60 * 1000) / this.providerConfig.rateLimit // ms per request

    if (timeSinceLastRequest < minInterval) {
      const delay = minInterval - timeSinceLastRequest
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  /**
   * Update request metrics
   */
  private updateMetrics(success: boolean, responseTime: number): void {
    this.requestCount++
    this.lastRequestTime = Date.now()
    
    // Store metrics for calculating averages
    // In a real implementation, this would use a proper metrics store
  }

  /**
   * Get average response time
   */
  private getAverageResponseTime(): number {
    // Placeholder - would calculate from stored metrics
    return 1500
  }

  /**
   * Get reliability score (0-1)
   */
  private getReliability(): number {
    // Placeholder - would calculate from success/failure rates
    return 0.95
  }

  /**
   * Get accuracy score (0-1)
   */
  private getAccuracy(): number {
    // Placeholder - would calculate from prediction accuracy
    return 0.85
  }

  /**
   * Format error message with provider context
   */
  protected createProviderError(message: string, originalError?: Error): ProviderError {
    return new ProviderError(
      message,
      this.getProviderName(),
      {
        originalError: originalError?.message,
        endpointUrl: this.getEndpointUrl(),
        requestCount: this.requestCount
      }
    )
  }

  /**
   * Helper method to check if API key is available
   */
  protected hasApiKey(): boolean {
    return !!this.providerConfig.apiKey
  }

  /**
   * Helper method to get authorization headers
   */
  protected getAuthHeaders(): Record<string, string> {
    if (!this.providerConfig.apiKey) {
      return {}
    }

    // Override in specific providers for different auth methods
    return {
      'Authorization': `Bearer ${this.providerConfig.apiKey}`
    }
  }

  /**
   * Helper method to build query parameters
   */
  protected buildQueryParams(params: Record<string, any>): Record<string, string> {
    const queryParams: Record<string, string> = {}
    
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        queryParams[key] = String(value)
      }
    }
    
    return queryParams
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Clear any pending rate limit timers, close connections, etc.
    this.rateLimitQueue.length = 0
  }
}