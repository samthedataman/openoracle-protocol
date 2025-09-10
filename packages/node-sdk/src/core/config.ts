/**
 * Configuration management for OpenOracle SDK
 */

import { config } from 'dotenv'
import { ConfigurationError } from './exceptions'
import { OracleProvider, ChainId, CacheStrategy, RoutingStrategy } from '../types/enums'

export interface APIConfig {
  openai?: string
  chainlink?: string
  pyth?: string
  uma?: string
  band?: string
  api3?: string
  twitter?: {
    bearerToken?: string
    apiKey?: string
    apiSecret?: string
    accessToken?: string
    accessTokenSecret?: string
  }
  polygon?: string
  etherscan?: string
  moralis?: string
  alchemy?: string
}

export interface NetworkConfig {
  defaultChain: ChainId
  rpcs: Partial<Record<ChainId, string>>
  timeouts: {
    connection: number
    request: number
    retry: number
  }
  retries: {
    maxAttempts: number
    backoffMs: number
    maxBackoffMs: number
  }
}

export interface CacheConfig {
  strategy: CacheStrategy
  ttlSeconds: number
  maxSize: number
  persistPath?: string
}

export interface RoutingConfig {
  strategy: RoutingStrategy
  preferredProviders: OracleProvider[]
  fallbackProviders: OracleProvider[]
  consensusThreshold: number
  maxProviders: number
  costWeighting: number
  speedWeighting: number
  accuracyWeighting: number
}

export interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'debug'
  format: 'json' | 'text'
  destination: 'console' | 'file' | 'both'
  filePath?: string
  maxFileSize?: string
  maxFiles?: number
}

export interface OracleConfigOptions {
  apiKeys?: APIConfig
  network?: Partial<NetworkConfig>
  cache?: Partial<CacheConfig>
  routing?: Partial<RoutingConfig>
  logging?: Partial<LoggingConfig>
  environment?: 'development' | 'staging' | 'production'
}

export class OracleConfig {
  public readonly apiKeys: APIConfig
  public readonly network: NetworkConfig
  public readonly cache: CacheConfig
  public readonly routing: RoutingConfig
  public readonly logging: LoggingConfig
  public readonly environment: 'development' | 'staging' | 'production'

  constructor(options: OracleConfigOptions = {}) {
    this.environment = options.environment || process.env.NODE_ENV as any || 'development'
    
    this.apiKeys = {
      openai: options.apiKeys?.openai || process.env.OPENAI_API_KEY,
      chainlink: options.apiKeys?.chainlink || process.env.CHAINLINK_API_KEY,
      pyth: options.apiKeys?.pyth || process.env.PYTH_API_KEY,
      uma: options.apiKeys?.uma || process.env.UMA_API_KEY,
      band: options.apiKeys?.band || process.env.BAND_API_KEY,
      api3: options.apiKeys?.api3 || process.env.API3_API_KEY,
      twitter: {
        bearerToken: options.apiKeys?.twitter?.bearerToken || process.env.TWITTER_BEARER_TOKEN,
        apiKey: options.apiKeys?.twitter?.apiKey || process.env.TWITTER_API_KEY,
        apiSecret: options.apiKeys?.twitter?.apiSecret || process.env.TWITTER_API_SECRET,
        accessToken: options.apiKeys?.twitter?.accessToken || process.env.TWITTER_ACCESS_TOKEN,
        accessTokenSecret: options.apiKeys?.twitter?.accessTokenSecret || process.env.TWITTER_ACCESS_TOKEN_SECRET,
      },
      polygon: options.apiKeys?.polygon || process.env.POLYGON_API_KEY,
      etherscan: options.apiKeys?.etherscan || process.env.ETHERSCAN_API_KEY,
      moralis: options.apiKeys?.moralis || process.env.MORALIS_API_KEY,
      alchemy: options.apiKeys?.alchemy || process.env.ALCHEMY_API_KEY,
      ...options.apiKeys
    }

    this.network = {
      defaultChain: options.network?.defaultChain || ChainId.ETHEREUM,
      rpcs: {
        [ChainId.ETHEREUM]: process.env.ETHEREUM_RPC || 'https://eth.llamarpc.com',
        [ChainId.POLYGON]: process.env.POLYGON_RPC || 'https://polygon.llamarpc.com',
        [ChainId.BSC]: process.env.BSC_RPC || 'https://bsc.llamarpc.com',
        [ChainId.ARBITRUM]: process.env.ARBITRUM_RPC || 'https://arbitrum.llamarpc.com',
        [ChainId.OPTIMISM]: process.env.OPTIMISM_RPC || 'https://optimism.llamarpc.com',
        [ChainId.FLOW_EVM]: process.env.FLOW_EVM_RPC || 'https://mainnet.evm.nodes.onflow.org',
        [ChainId.FLOW_TESTNET]: process.env.FLOW_TESTNET_RPC || 'https://testnet.evm.nodes.onflow.org',
        ...options.network?.rpcs
      },
      timeouts: {
        connection: options.network?.timeouts?.connection || 10000,
        request: options.network?.timeouts?.request || 30000,
        retry: options.network?.timeouts?.retry || 5000
      },
      retries: {
        maxAttempts: options.network?.retries?.maxAttempts || 3,
        backoffMs: options.network?.retries?.backoffMs || 1000,
        maxBackoffMs: options.network?.retries?.maxBackoffMs || 10000
      }
    }

    this.cache = {
      strategy: options.cache?.strategy || CacheStrategy.MEMORY_ONLY,
      ttlSeconds: options.cache?.ttlSeconds || 300, // 5 minutes
      maxSize: options.cache?.maxSize || 1000,
      persistPath: options.cache?.persistPath || './cache',
      ...options.cache
    }

    this.routing = {
      strategy: options.routing?.strategy || RoutingStrategy.BALANCED,
      preferredProviders: options.routing?.preferredProviders || [
        OracleProvider.CHAINLINK,
        OracleProvider.PYTH
      ],
      fallbackProviders: options.routing?.fallbackProviders || [
        OracleProvider.UMA,
        OracleProvider.BAND,
        OracleProvider.API3
      ],
      consensusThreshold: options.routing?.consensusThreshold || 0.8,
      maxProviders: options.routing?.maxProviders || 3,
      costWeighting: options.routing?.costWeighting || 0.3,
      speedWeighting: options.routing?.speedWeighting || 0.4,
      accuracyWeighting: options.routing?.accuracyWeighting || 0.3,
      ...options.routing
    }

    this.logging = {
      level: options.logging?.level || (this.environment === 'production' ? 'error' : 'info'),
      format: options.logging?.format || 'text',
      destination: options.logging?.destination || 'console',
      filePath: options.logging?.filePath || './logs/openoracle.log',
      maxFileSize: options.logging?.maxFileSize || '10m',
      maxFiles: options.logging?.maxFiles || 5,
      ...options.logging
    }

    this.validateConfig()
  }

  /**
   * Create configuration from environment variables
   */
  static fromEnv(envPath?: string): OracleConfig {
    if (envPath) {
      config({ path: envPath })
    } else {
      config()
    }

    return new OracleConfig()
  }

  /**
   * Create configuration from JSON object
   */
  static fromJSON(json: string | object): OracleConfig {
    const options = typeof json === 'string' ? JSON.parse(json) : json
    return new OracleConfig(options)
  }

  /**
   * Create configuration from file
   */
  static async fromFile(filePath: string): Promise<OracleConfig> {
    try {
      const fs = await import('fs/promises')
      const content = await fs.readFile(filePath, 'utf-8')
      return OracleConfig.fromJSON(content)
    } catch (error) {
      throw new ConfigurationError(`Failed to load config from file: ${filePath}`, {
        filePath,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  /**
   * Validate configuration values
   */
  private validateConfig(): void {
    // Validate API keys for critical providers
    if (!this.apiKeys.openai && this.environment === 'production') {
      throw new ConfigurationError('OpenAI API key is required for production')
    }

    // Validate network configuration
    if (this.network.timeouts.connection <= 0) {
      throw new ConfigurationError('Connection timeout must be positive')
    }

    if (this.network.retries.maxAttempts < 1) {
      throw new ConfigurationError('Max retry attempts must be at least 1')
    }

    // Validate routing configuration
    if (this.routing.consensusThreshold < 0 || this.routing.consensusThreshold > 1) {
      throw new ConfigurationError('Consensus threshold must be between 0 and 1')
    }

    const totalWeighting = this.routing.costWeighting + 
                          this.routing.speedWeighting + 
                          this.routing.accuracyWeighting
    
    if (Math.abs(totalWeighting - 1.0) > 0.01) {
      throw new ConfigurationError('Routing weightings must sum to 1.0')
    }

    // Validate cache configuration
    if (this.cache.ttlSeconds <= 0) {
      throw new ConfigurationError('Cache TTL must be positive')
    }

    if (this.cache.maxSize <= 0) {
      throw new ConfigurationError('Cache max size must be positive')
    }
  }

  /**
   * Get RPC URL for specific chain
   */
  getRpcUrl(chainId: ChainId): string {
    const url = this.network.rpcs[chainId]
    if (!url) {
      throw new ConfigurationError(`No RPC URL configured for chain ${chainId}`)
    }
    return url
  }

  /**
   * Check if API key is available for provider
   */
  hasApiKey(provider: OracleProvider): boolean {
    switch (provider) {
      case OracleProvider.CHAINLINK:
        return !!this.apiKeys.chainlink
      case OracleProvider.PYTH:
        return !!this.apiKeys.pyth
      case OracleProvider.UMA:
        return !!this.apiKeys.uma
      case OracleProvider.BAND:
        return !!this.apiKeys.band
      case OracleProvider.API3:
        return !!this.apiKeys.api3
      default:
        return false
    }
  }

  /**
   * Export configuration as JSON
   */
  toJSON(): OracleConfigOptions {
    return {
      apiKeys: this.apiKeys,
      network: this.network,
      cache: this.cache,
      routing: this.routing,
      logging: this.logging,
      environment: this.environment
    }
  }

  /**
   * Create a copy of the configuration with modifications
   */
  withOptions(options: Partial<OracleConfigOptions>): OracleConfig {
    return new OracleConfig({
      ...this.toJSON(),
      ...options
    })
  }
}

// Default configuration instance
let defaultConfig: OracleConfig | null = null

/**
 * Get the default configuration instance
 */
export function getConfig(): OracleConfig {
  if (!defaultConfig) {
    defaultConfig = OracleConfig.fromEnv()
  }
  return defaultConfig
}

/**
 * Set the default configuration instance
 */
export function setConfig(config: OracleConfig): void {
  defaultConfig = config
}