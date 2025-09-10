import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setDefaultAPI } from '../services/api'
import type { ApiConfig, OracleHealthCheckResponse } from '../types'

// ============ Oracle Context Types ============

export interface OracleConfig extends ApiConfig {
  queryClient?: QueryClient
  enableDevtools?: boolean
  defaultStaleTime?: number
  defaultCacheTime?: number
}

export interface OracleContextValue {
  config: OracleConfig
  isInitialized: boolean
  health: OracleHealthCheckResponse | null
  updateConfig: (newConfig: Partial<OracleConfig>) => void
}

// ============ Oracle Context ============

const OracleContext = createContext<OracleContextValue | null>(null)

export const useOracleContext = (): OracleContextValue => {
  const context = useContext(OracleContext)
  if (!context) {
    throw new Error('useOracleContext must be used within an OracleProvider')
  }
  return context
}

// ============ Oracle Provider Component ============

export interface OracleProviderProps {
  children: ReactNode
  config: OracleConfig
  queryClient?: QueryClient
}

export const OracleProvider: React.FC<OracleProviderProps> = ({
  children,
  config,
  queryClient: externalQueryClient
}) => {
  const [internalConfig, setInternalConfig] = useState<OracleConfig>(config)
  const [isInitialized, setIsInitialized] = useState(false)
  const [health, setHealth] = useState<OracleHealthCheckResponse | null>(null)
  
  // Create default query client if none provided
  const [queryClient] = useState(() => {
    if (externalQueryClient) return externalQueryClient
    if (config.queryClient) return config.queryClient
    
    return new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: config.defaultStaleTime || 30000, // 30 seconds
          gcTime: config.defaultCacheTime || 5 * 60 * 1000, // 5 minutes
          retry: (failureCount, error: any) => {
            // Don't retry on 4xx errors
            if (error?.status >= 400 && error?.status < 500) {
              return false
            }
            return failureCount < 3
          },
          refetchOnWindowFocus: false,
          refetchOnMount: true
        },
        mutations: {
          retry: 1
        }
      }
    })
  })
  
  // Initialize the API client
  useEffect(() => {
    if (!internalConfig.baseUrl) {
      console.error('OracleProvider: baseUrl is required in config')
      return
    }
    
    try {
      setDefaultAPI(internalConfig)
      setIsInitialized(true)
      
      // Perform initial health check
      const healthCheck = async () => {
        try {
          const response = await fetch(`${internalConfig.baseUrl}/api/oracle/health`, {
            headers: internalConfig.apiKey ? {
              'Authorization': `Bearer ${internalConfig.apiKey}`
            } : {}
          })
          
          if (response.ok) {
            const healthData = await response.json()
            setHealth(healthData)
          }
        } catch (error) {
          console.warn('Oracle health check failed:', error)
        }
      }
      
      healthCheck()
      
      // Set up periodic health checks (every 5 minutes)
      const healthInterval = setInterval(healthCheck, 5 * 60 * 1000)
      
      return () => clearInterval(healthInterval)
      
    } catch (error) {
      console.error('Failed to initialize OracleProvider:', error)
      setIsInitialized(false)
    }
  }, [internalConfig])
  
  const updateConfig = React.useCallback((newConfig: Partial<OracleConfig>) => {
    setInternalConfig(prev => ({ ...prev, ...newConfig }))
  }, [])
  
  const contextValue: OracleContextValue = {
    config: internalConfig,
    isInitialized,
    health,
    updateConfig
  }
  
  return (
    <OracleContext.Provider value={contextValue}>
      <QueryClientProvider client={queryClient}>
        {children}
        {config.enableDevtools && process.env.NODE_ENV === 'development' && (
          <DevTools queryClient={queryClient} />
        )}
      </QueryClientProvider>
    </OracleContext.Provider>
  )
}

// ============ Development Tools Component ============

const DevTools: React.FC<{ queryClient: QueryClient }> = ({ queryClient }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [queries, setQueries] = useState<any[]>([])
  
  useEffect(() => {
    const updateQueries = () => {
      const queryCache = queryClient.getQueryCache()
      const allQueries = queryCache.getAll()
      setQueries(allQueries.map(query => ({
        queryKey: query.queryKey,
        status: query.state.status,
        dataUpdatedAt: query.state.dataUpdatedAt,
        errorUpdatedAt: query.state.errorUpdatedAt,
        fetchStatus: query.state.fetchStatus,
        data: query.state.data,
        error: query.state.error
      })))
    }
    
    updateQueries()
    const unsubscribe = queryClient.getQueryCache().subscribe(updateQueries)
    
    return unsubscribe
  }, [queryClient])
  
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 9999,
          padding: '8px 16px',
          background: '#007acc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '12px',
          cursor: 'pointer'
        }}
      >
        Open Oracle DevTools
      </button>
    )
  }
  
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '400px',
        height: '100vh',
        background: 'white',
        border: '1px solid #ccc',
        zIndex: 9999,
        padding: '20px',
        overflow: 'auto',
        fontSize: '12px',
        fontFamily: 'monospace'
      }}
    >
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Oracle DevTools</h3>
        <button onClick={() => setIsOpen(false)} style={{ cursor: 'pointer' }}>✕</button>
      </div>
      
      <div>
        <h4>Query Cache ({queries.length} queries)</h4>
        {queries.map((query, index) => (
          <details key={index} style={{ marginBottom: '10px', border: '1px solid #eee', padding: '8px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              {JSON.stringify(query.queryKey)} - {query.status}
            </summary>
            <div style={{ marginTop: '8px' }}>
              <div><strong>Status:</strong> {query.status}</div>
              <div><strong>Fetch Status:</strong> {query.fetchStatus}</div>
              <div><strong>Data Updated:</strong> {new Date(query.dataUpdatedAt).toLocaleTimeString()}</div>
              {query.error && (
                <div><strong>Error:</strong> {query.error.message}</div>
              )}
              <details style={{ marginTop: '8px' }}>
                <summary>Data</summary>
                <pre style={{ fontSize: '10px', overflow: 'auto' }}>
                  {JSON.stringify(query.data, null, 2)}
                </pre>
              </details>
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}

// ============ Higher-Order Component ============

export interface WithOracleProps {
  oracle: OracleContextValue
}

export const withOracle = <P extends WithOracleProps>(
  Component: React.ComponentType<P>
) => {
  return (props: Omit<P, 'oracle'>) => {
    const oracle = useOracleContext()
    return <Component {...(props as P)} oracle={oracle} />
  }
}

// ============ Provider Status Component ============

export interface OracleStatusProps {
  showHealth?: boolean
  showConfig?: boolean
  className?: string
  style?: React.CSSProperties
}

export const OracleStatus: React.FC<OracleStatusProps> = ({
  showHealth = true,
  showConfig = false,
  className,
  style
}) => {
  const { config, isInitialized, health } = useOracleContext()
  
  const getHealthColor = () => {
    if (!health) return 'gray'
    switch (health.overall_status) {
      case 'healthy': return 'green'
      case 'degraded': return 'orange'
      case 'down': return 'red'
      default: return 'gray'
    }
  }
  
  return (
    <div className={className} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>Oracle Status:</span>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isInitialized ? getHealthColor() : 'gray',
            display: 'inline-block'
          }}
        />
        <span>{isInitialized ? (health?.overall_status || 'unknown') : 'disconnected'}</span>
      </div>
      
      {showHealth && health && (
        <div style={{ marginTop: '8px', fontSize: '12px' }}>
          <div>Providers: {Object.keys(health.providers).length}</div>
          <div>Updated: {new Date(health.timestamp).toLocaleTimeString()}</div>
        </div>
      )}
      
      {showConfig && (
        <div style={{ marginTop: '8px', fontSize: '12px' }}>
          <div>Base URL: {config.baseUrl}</div>
          <div>API Key: {config.apiKey ? '***' + config.apiKey.slice(-4) : 'Not set'}</div>
        </div>
      )}
    </div>
  )
}