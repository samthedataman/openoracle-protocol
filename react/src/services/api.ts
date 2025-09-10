import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios'
import type {
  ApiResponse,
  ApiError,
  ApiConfig,
  OracleRoutingRequest,
  OracleRoutingResponse,
  PriceFeedData,
  AggregatedPrice,
  PollCreationRequest,
  PollCreationResponse,
  OracleHealthCheckResponse,
  SupportedFeedsResponse
} from '../types'

export class OpenOracleAPI {
  private client: AxiosInstance
  private config: ApiConfig

  constructor(config: ApiConfig) {
    this.config = config
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
      }
    })

    // Request interceptor for adding auth
    this.client.interceptors.request.use((config) => {
      if (this.config.apiKey && !config.headers?.Authorization) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${this.config.apiKey}`
        }
      }
      return config
    })

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const apiError: ApiError = new Error(
          error.response?.data?.error || error.message
        ) as ApiError
        
        apiError.status = error.response?.status
        apiError.code = error.code
        apiError.details = error.response?.data
        
        return Promise.reject(apiError)
      }
    )
  }

  // ============ Oracle Routes ============

  async routeQuestion(request: OracleRoutingRequest): Promise<OracleRoutingResponse> {
    const response = await this.client.post<OracleRoutingResponse>(
      '/api/oracle/route',
      request
    )
    return response.data
  }

  async getChainlinkPrice(pair: string = 'ETH/USD', chain: string = 'ethereum'): Promise<PriceFeedData> {
    const response = await this.client.get<PriceFeedData>(
      '/api/oracle/chainlink/price-feed',
      { params: { pair, chain } }
    )
    return response.data
  }

  async getPythPrice(symbol: string = 'BTC/USD', chain: string = 'ethereum'): Promise<PriceFeedData> {
    const response = await this.client.get<PriceFeedData>(
      '/api/oracle/pyth/price-feed',
      { params: { symbol, chain } }
    )
    return response.data
  }

  async getAggregatedPrice(
    asset: string = 'ETH/USD',
    providers?: string[]
  ): Promise<AggregatedPrice> {
    const params: any = { asset }
    if (providers) {
      params.providers = providers
    }
    
    const response = await this.client.get<AggregatedPrice>(
      '/api/oracle/aggregated-price',
      { params }
    )
    return response.data
  }

  async createOraclePoll(request: PollCreationRequest): Promise<PollCreationResponse> {
    const response = await this.client.post<PollCreationResponse>(
      '/api/oracle/create-oracle-poll',
      request
    )
    return response.data
  }

  async getSupportedFeeds(
    provider?: string,
    category?: string
  ): Promise<SupportedFeedsResponse> {
    const params: any = {}
    if (provider) params.provider = provider
    if (category) params.category = category
    
    const response = await this.client.get<SupportedFeedsResponse>(
      '/api/oracle/supported-feeds',
      { params }
    )
    return response.data
  }

  async getOracleHealth(): Promise<OracleHealthCheckResponse> {
    const response = await this.client.get<OracleHealthCheckResponse>(
      '/api/oracle/health'
    )
    return response.data
  }

  // ============ Poll/Market Routes ============

  async getPolls(filters?: Record<string, any>) {
    const response = await this.client.get('/api/polls/', { params: filters })
    return response.data
  }

  async getPoll(pollId: string) {
    const response = await this.client.get(`/api/polls/${pollId}`)
    return response.data
  }

  async createPoll(pollData: any) {
    const response = await this.client.post('/api/polls/', pollData)
    return response.data
  }

  async votePoll(pollId: string, voteData: any) {
    const response = await this.client.post(`/api/polls/${pollId}/vote`, voteData)
    return response.data
  }

  async getPollStats(pollId: string) {
    const response = await this.client.get(`/api/polls/${pollId}/stats`)
    return response.data
  }

  // ============ Extension/News Routes ============

  async analyzeNews(newsData: any) {
    const response = await this.client.post('/api/extension/analyze-news', newsData)
    return response.data
  }

  async generatePollFromNews(newsData: any) {
    const response = await this.client.post('/api/extension/generate-poll', newsData)
    return response.data
  }

  // ============ Twitter Analysis ============

  async analyzeTwitterQuestion(question: string) {
    const response = await this.client.post('/api/oracle/twitter/analyze', {
      question
    })
    return response.data
  }

  // ============ Utility Methods ============

  updateConfig(newConfig: Partial<ApiConfig>) {
    this.config = { ...this.config, ...newConfig }
    
    if (newConfig.apiKey) {
      this.client.defaults.headers.Authorization = `Bearer ${newConfig.apiKey}`
    }
    
    if (newConfig.baseUrl) {
      this.client.defaults.baseURL = newConfig.baseUrl
    }
    
    if (newConfig.headers) {
      this.client.defaults.headers = {
        ...this.client.defaults.headers,
        ...newConfig.headers
      }
    }
  }

  // Generic request method for custom endpoints
  async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.client.request<T>(config)
    return response.data
  }

  // Health check for the API
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health')
      return true
    } catch {
      return false
    }
  }
}

// Default singleton instance
let defaultAPI: OpenOracleAPI | null = null

export const createAPI = (config: ApiConfig): OpenOracleAPI => {
  return new OpenOracleAPI(config)
}

export const getDefaultAPI = (): OpenOracleAPI => {
  if (!defaultAPI) {
    throw new Error('Default API not initialized. Call setDefaultAPI first.')
  }
  return defaultAPI
}

export const setDefaultAPI = (config: ApiConfig): void => {
  defaultAPI = new OpenOracleAPI(config)
}

// Error handling utilities
export const isApiError = (error: any): error is ApiError => {
  return error && typeof error.status === 'number'
}

export const handleApiError = (error: ApiError) => {
  console.error('API Error:', {
    message: error.message,
    status: error.status,
    code: error.code,
    details: error.details
  })
  
  // You can add custom error handling logic here
  // For example, show toast notifications, redirect on auth errors, etc.
}