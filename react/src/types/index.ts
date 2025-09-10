// Export all types from a single entry point
export * from './oracle'
export * from './market'
export * from './wallet'

// Common utility types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp: string
}

export interface PaginatedResponse<T = any> extends ApiResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface ErrorResponse extends ApiResponse {
  success: false
  error: string
  details?: Record<string, any>
}

// Hook configuration types
export interface HookConfig {
  enabled?: boolean
  retry?: boolean | number
  retryDelay?: number
  refetchOnWindowFocus?: boolean
  refetchOnMount?: boolean
  staleTime?: number
  cacheTime?: number
}

// WebSocket types
export interface WebSocketConfig {
  url: string
  reconnect?: boolean
  reconnectAttempts?: number
  reconnectDelay?: number
  heartbeatInterval?: number
}

export interface WebSocketMessage<T = any> {
  type: string
  data: T
  timestamp: string
  id?: string
}

// Loading states
export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

// Generic async state
export interface AsyncState<T = any, E = Error> {
  data: T | null
  loading: boolean
  error: E | null
  status: LoadingState
}