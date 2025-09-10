/**
 * Base Oracle Adapter for OpenOracle Protocol (Node.js/TypeScript)
 * 
 * This module provides the base interface for all oracle adapters, making it easy
 * to integrate new oracle providers into the OpenOracle ecosystem.
 */

export enum DataType {
  PRICE = 'price',
  WEATHER = 'weather',
  SPORTS = 'sports',
  CUSTOM = 'custom',
  NEWS = 'news',
  SOCIAL = 'social'
}

export enum ResponseFormat {
  JSON = 'json',
  XML = 'xml',
  TEXT = 'text',
  BINARY = 'binary'
}

export interface OracleRequest {
  query: string
  dataType: DataType
  parameters?: Record<string, any>
  timeout?: number
  format?: ResponseFormat
  metadata?: Record<string, any>
}

export interface OracleResponse {
  data: any
  provider: string
  timestamp: number
  confidence: number
  latencyMs: number
  cost: number
  metadata?: Record<string, any>
  error?: string
}

export interface HealthStatus {
  isHealthy: boolean
  responseTimeMs: number
  errorRate: number
  lastError?: string
  uptimePercentage: number
}

export interface AdapterStats {
  name: string
  version: string
  requests: number
  errors: number
  successRate: number
  avgLatencyMs: number
  supportedDataTypes: string[]
}

export interface AdapterConfig {
  apiKey?: string
  baseUrl?: string
  timeout?: number
  region?: string
  [key: string]: any
}

/**
 * Base class for all oracle adapters.
 * 
 * This provides a standard interface that all oracle providers must implement,
 * ensuring consistency and making it easy to add new providers.
 */
export abstract class BaseOracleAdapter {
  protected config: AdapterConfig
  public readonly name: string
  public readonly version: string
  public readonly supportedDataTypes: DataType[]
  
  private stats = {
    requests: 0,
    errors: 0,
    totalLatency: 0,
    lastError: null as string | null
  }

  constructor(config: AdapterConfig) {
    this.config = config
    this.name = this.getAdapterName()
    this.version = this.getAdapterVersion()
    this.supportedDataTypes = this.getSupportedDataTypes()
  }

  /**
   * Return the adapter name (e.g., 'chainlink', 'pyth')
   */
  protected abstract getAdapterName(): string

  /**
   * Return the adapter version
   */
  protected abstract getAdapterVersion(): string

  /**
   * Return list of supported data types
   */
  protected abstract getSupportedDataTypes(): DataType[]

  /**
   * Execute the actual oracle query - implement in subclass
   */
  protected abstract executeQuery(request: OracleRequest): Promise<any>

  /**
   * Execute oracle query with error handling and metrics collection.
   */
  async query(request: OracleRequest): Promise<OracleResponse> {
    const startTime = Date.now()
    this.stats.requests++

    try {
      // Validate request
      this.validateRequest(request)

      // Execute query with timeout
      const timeoutMs = request.timeout || 30000
      const data = await this.withTimeout(
        this.executeQuery(request),
        timeoutMs
      )

      // Calculate metrics
      const latencyMs = Date.now() - startTime
      this.stats.totalLatency += latencyMs

      return {
        data,
        provider: this.name,
        timestamp: Date.now(),
        confidence: this.calculateConfidence(data, request),
        latencyMs,
        cost: this.calculateCost(request),
        metadata: this.getResponseMetadata(request)
      }

    } catch (error) {
      this.stats.errors++
      this.stats.lastError = error instanceof Error ? error.message : String(error)

      console.error(`Oracle query failed for ${this.name}:`, error)

      return {
        data: null,
        provider: this.name,
        timestamp: Date.now(),
        confidence: 0.0,
        latencyMs: Date.now() - startTime,
        cost: 0,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Validate oracle request format
   */
  private validateRequest(request: OracleRequest): void {
    if (!request.query) {
      throw new Error('Query cannot be empty')
    }

    if (!this.supportedDataTypes.includes(request.dataType)) {
      throw new Error(`Unsupported data type: ${request.dataType}`)
    }
  }

  /**
   * Calculate confidence score for response - override in subclass
   */
  protected calculateConfidence(data: any, request: OracleRequest): number {
    return data !== null && data !== undefined ? 1.0 : 0.0
  }

  /**
   * Calculate cost for request - override in subclass
   */
  protected calculateCost(request: OracleRequest): number {
    return 0.0
  }

  /**
   * Get response metadata - override in subclass
   */
  protected getResponseMetadata(request: OracleRequest): Record<string, any> {
    return {}
  }

  /**
   * Get adapter health status with basic metrics.
   * Override in subclass for provider-specific health checks.
   */
  async getHealthStatus(): Promise<HealthStatus> {
    try {
      const start = Date.now()
      await this.healthCheckQuery()
      const responseTime = Date.now() - start

      const errorRate = this.stats.requests > 0 
        ? (this.stats.errors / this.stats.requests) * 100 
        : 0

      return {
        isHealthy: true,
        responseTimeMs: responseTime,
        errorRate,
        lastError: this.stats.lastError || undefined,
        uptimePercentage: 100 - errorRate
      }

    } catch (error) {
      return {
        isHealthy: false,
        responseTimeMs: 30000, // Timeout
        errorRate: 100.0,
        lastError: error instanceof Error ? error.message : String(error),
        uptimePercentage: 0
      }
    }
  }

  /**
   * Override in subclass for provider-specific health check
   */
  protected async healthCheckQuery(): Promise<any> {
    return true
  }

  /**
   * Get adapter performance statistics
   */
  getStats(): AdapterStats {
    const avgLatency = this.stats.requests > 0 
      ? this.stats.totalLatency / this.stats.requests 
      : 0

    const successRate = this.stats.requests > 0 
      ? (1 - (this.stats.errors / this.stats.requests)) * 100 
      : 100

    return {
      name: this.name,
      version: this.version,
      requests: this.stats.requests,
      errors: this.stats.errors,
      successRate,
      avgLatencyMs: avgLatency,
      supportedDataTypes: this.supportedDataTypes.map(dt => dt.toString())
    }
  }

  /**
   * Reset adapter statistics
   */
  resetStats(): void {
    this.stats = {
      requests: 0,
      errors: 0,
      totalLatency: 0,
      lastError: null
    }
  }

  /**
   * Utility method to add timeout to promises
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
      )
    ])
  }
}

/**
 * Registry for managing oracle adapters.
 * 
 * This makes it easy to register new adapters and route queries
 * to the appropriate providers.
 */
export class OracleAdapterRegistry {
  private adapters = new Map<string, BaseOracleAdapter>()

  /**
   * Register a new oracle adapter
   */
  registerAdapter(adapter: BaseOracleAdapter): void {
    this.adapters.set(adapter.name, adapter)
    console.log(`Registered oracle adapter: ${adapter.name}`)
  }

  /**
   * Unregister an oracle adapter
   */
  unregisterAdapter(name: string): void {
    if (this.adapters.delete(name)) {
      console.log(`Unregistered oracle adapter: ${name}`)
    }
  }

  /**
   * Get adapter by name
   */
  getAdapter(name: string): BaseOracleAdapter | undefined {
    return this.adapters.get(name)
  }

  /**
   * List all registered adapter names
   */
  listAdapters(): string[] {
    return Array.from(this.adapters.keys())
  }

  /**
   * Get all adapters that support a specific data type
   */
  getAdaptersForDataType(dataType: DataType): BaseOracleAdapter[] {
    return Array.from(this.adapters.values()).filter(
      adapter => adapter.supportedDataTypes.includes(dataType)
    )
  }

  /**
   * Query the best available adapter for a request.
   * 
   * This provides automatic adapter selection based on:
   * - Data type support
   * - Adapter health
   * - Performance metrics
   */
  async queryBestAdapter(
    request: OracleRequest,
    preferredAdapters?: string[]
  ): Promise<OracleResponse> {
    let availableAdapters = this.getAdaptersForDataType(request.dataType)

    if (availableAdapters.length === 0) {
      return {
        data: null,
        provider: 'none',
        timestamp: Date.now(),
        confidence: 0.0,
        latencyMs: 0,
        cost: 0,
        error: `No adapters available for data type: ${request.dataType}`
      }
    }

    // Filter by preferred adapters if specified
    if (preferredAdapters && preferredAdapters.length > 0) {
      availableAdapters = availableAdapters.filter(
        adapter => preferredAdapters.includes(adapter.name)
      )
    }

    // Sort by health and performance
    availableAdapters.sort((a, b) => {
      const statsA = a.getStats()
      const statsB = b.getStats()
      
      // Sort by success rate (descending) then by latency (ascending)
      if (statsA.successRate !== statsB.successRate) {
        return statsB.successRate - statsA.successRate
      }
      return statsA.avgLatencyMs - statsB.avgLatencyMs
    })

    // Try adapters in order until one succeeds
    let lastError: string | undefined

    for (const adapter of availableAdapters) {
      try {
        const response = await adapter.query(request)
        if (!response.error) {
          return response
        }
        lastError = response.error
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
        continue
      }
    }

    // All adapters failed
    return {
      data: null,
      provider: 'failed',
      timestamp: Date.now(),
      confidence: 0.0,
      latencyMs: 0,
      cost: 0,
      error: `All adapters failed. Last error: ${lastError}`
    }
  }
}

// Global registry instance
export const oracleRegistry = new OracleAdapterRegistry()