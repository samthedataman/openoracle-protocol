/**
 * OpenOracle SDK Client - Core client for API interactions
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { OracleConfig } from './config'
import { NetworkError, AuthenticationError, RateLimitError, TimeoutError, ValidationError } from './exceptions'

export interface ClientOptions {
  baseURL?: string
  timeout?: number
  retries?: number
  headers?: Record<string, string>
}

export class OracleClient {
  private readonly axios: AxiosInstance
  private readonly config: OracleConfig
  private requestCount = 0
  private lastRequestTime = 0

  constructor(config: OracleConfig, options?: ClientOptions) {
    this.config = config

    this.axios = axios.create({
      baseURL: options?.baseURL || 'http://localhost:8000',
      timeout: options?.timeout || config.network.timeouts.request,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'openoracle-sdk-node/0.1.0',
        ...options?.headers
      }
    })

    this.setupInterceptors()
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.axios.interceptors.request.use(
      (config) => {
        this.requestCount++
        this.lastRequestTime = Date.now()

        // Add authentication if available
        if (this.config.apiKeys.openai) {
          config.headers = config.headers || {}
          config.headers['Authorization'] = `Bearer ${this.config.apiKeys.openai}`
        }

        return config
      },
      (error) => {
        return Promise.reject(this.normalizeError(error))
      }
    )

    // Response interceptor
    this.axios.interceptors.response.use(
      (response) => {
        return response
      },
      (error) => {
        return Promise.reject(this.normalizeError(error))
      }
    )
  }

  private normalizeError(error: any): Error {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const message = error.response?.data?.message || error.message

      switch (status) {
        case 401:
          return new AuthenticationError(message, {
            url: error.config?.url,
            method: error.config?.method
          })
        case 429:
          const retryAfter = error.response?.headers['retry-after']
          return new RateLimitError(message, retryAfter ? parseInt(retryAfter) : undefined, {
            url: error.config?.url,
            method: error.config?.method
          })
        case 400:
          return new ValidationError(message, {
            url: error.config?.url,
            method: error.config?.method,
            data: error.config?.data
          })
        default:
          if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            return new TimeoutError(
              message,
              this.config.network.timeouts.request,
              {
                url: error.config?.url,
                method: error.config?.method
              }
            )
          }
          return new NetworkError(
            message,
            status,
            error.response?.data,
            {
              url: error.config?.url,
              method: error.config?.method
            }
          )
      }
    }

    return error
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axios.get<T>(url, config)
    return response.data
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axios.post<T>(url, data, config)
    return response.data
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axios.put<T>(url, data, config)
    return response.data
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axios.patch<T>(url, data, config)
    return response.data
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axios.delete<T>(url, config)
    return response.data
  }

  async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.axios.request<T>(config)
    return response.data
  }

  // Health check endpoint
  async healthCheck(): Promise<boolean> {
    try {
      await this.get('/health')
      return true
    } catch (error) {
      return false
    }
  }

  // Get client statistics
  getStats(): { requestCount: number; lastRequestTime: number } {
    return {
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime
    }
  }

  // Update configuration
  updateConfig(config: OracleConfig): void {
    // Update timeout
    this.axios.defaults.timeout = config.network.timeouts.request

    // Update base URL if changed
    if (config.apiKeys.openai) {
      this.axios.defaults.headers.common['Authorization'] = `Bearer ${config.apiKeys.openai}`
    }
  }

  // Retry mechanism with exponential backoff
  async withRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = this.config.network.retries.maxAttempts
  ): Promise<T> {
    let lastError: Error

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error

        if (attempt === maxAttempts) {
          throw lastError
        }

        // Don't retry on authentication or validation errors
        if (error instanceof AuthenticationError || error instanceof ValidationError) {
          throw error
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.config.network.retries.backoffMs * Math.pow(2, attempt - 1),
          this.config.network.retries.maxBackoffMs
        )

        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError!
  }

  // Batch requests
  async batch<T>(requests: Array<() => Promise<T>>): Promise<T[]> {
    return Promise.all(requests.map(request => request()))
  }

  // Stream support for real-time data
  createEventStream(url: string, options?: { 
    onData?: (data: any) => void
    onError?: (error: Error) => void
    onClose?: () => void
  }): EventSource {
    const eventSource = new EventSource(url)

    if (options?.onData) {
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          options.onData!(data)
        } catch (error) {
          options.onError?.(error as Error)
        }
      }
    }

    if (options?.onError) {
      eventSource.onerror = (event) => {
        options.onError!(new NetworkError('EventSource error', undefined, event))
      }
    }

    if (options?.onClose) {
      eventSource.addEventListener('close', options.onClose)
    }

    return eventSource
  }

  // WebSocket support
  createWebSocket(url: string, protocols?: string | string[]): WebSocket {
    const ws = new WebSocket(url, protocols)
    
    // Add default error handling
    ws.onerror = (event) => {
      console.error('WebSocket error:', event)
    }

    return ws
  }

  // Cleanup
  destroy(): void {
    // Cancel any pending requests
    // Note: Axios doesn't provide a direct way to cancel all requests
    // This would require implementing a cancellation token system
  }
}