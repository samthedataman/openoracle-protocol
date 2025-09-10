import React from 'react'
import { useOracle } from '../hooks/useOracle'
import { formatTimeAgo, formatConfidence } from '../utils'
import type { OracleProvider } from '../types'

export interface OracleStatusProps {
  provider?: OracleProvider
  showDetails?: boolean
  showFeeds?: boolean
  className?: string
  style?: React.CSSProperties
}

export const OracleStatus: React.FC<OracleStatusProps> = ({
  provider,
  showDetails = true,
  showFeeds = false,
  className,
  style
}) => {
  const { health, supportedFeeds, isHealthy, isLoading } = useOracle()
  
  if (isLoading) {
    return (
      <div className={className} style={style}>
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ 
            width: '24px',
            height: '24px',
            border: '2px solid #f3f3f3',
            borderTop: '2px solid #007acc',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 8px'
          }} />
          <div style={{ fontSize: '14px', color: '#666' }}>
            Checking oracle status...
          </div>
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }
  
  if (!health) {
    return (
      <div className={className} style={style}>
        <div style={{ 
          padding: '16px',
          background: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '14px', color: '#856404' }}>
            Unable to connect to oracle services
          </div>
        </div>
      </div>
    )
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return '#28a745'
      case 'degraded': return '#ffc107'
      case 'down': return '#dc3545'
      default: return '#6c757d'
    }
  }
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '✅'
      case 'degraded': return '⚠️'
      case 'down': return '❌'
      default: return '❔'
    }
  }
  
  const providersToShow = provider ? [provider] : Object.keys(health.providers) as OracleProvider[]
  
  return (
    <div className={className} style={style}>
      {/* Overall Status */}
      <div style={{
        padding: '16px',
        background: isHealthy ? '#d4edda' : '#f8d7da',
        border: `1px solid ${isHealthy ? '#c3e6cb' : '#f5c6cb'}`,
        borderRadius: '8px',
        marginBottom: showDetails ? '16px' : '0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>
            {getStatusIcon(health.overall_status)}
          </span>
          <div>
            <div style={{ 
              fontSize: '16px', 
              fontWeight: '600',
              color: isHealthy ? '#155724' : '#721c24'
            }}>
              Oracle Network: {health.overall_status.toUpperCase()}
            </div>
            <div style={{ 
              fontSize: '12px',
              color: isHealthy ? '#155724' : '#721c24',
              opacity: 0.8
            }}>
              Last updated {formatTimeAgo(health.timestamp)}
            </div>
          </div>
        </div>
      </div>
      
      {/* Provider Details */}
      {showDetails && (
        <div>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
            Provider Status
          </h4>
          
          <div style={{ display: 'grid', gap: '8px' }}>
            {providersToShow.map(providerKey => {
              const providerInfo = health.providers[providerKey]
              if (!providerInfo) return null
              
              const statusColor = getStatusColor(providerInfo.status)
              const statusIcon = getStatusIcon(providerInfo.status)
              
              return (
                <div
                  key={providerKey}
                  style={{
                    padding: '12px',
                    border: `1px solid ${statusColor}20`,
                    borderRadius: '6px',
                    background: `${statusColor}05`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>{statusIcon}</span>
                      <span style={{ 
                        fontWeight: '500',
                        textTransform: 'capitalize',
                        color: '#1a1a1a'
                      }}>
                        {providerKey}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {providerInfo.active_feeds !== undefined && (
                        <span style={{ fontSize: '12px', color: '#666' }}>
                          {providerInfo.active_feeds} feeds
                        </span>
                      )}
                      {providerInfo.active_requests !== undefined && (
                        <span style={{ fontSize: '12px', color: '#666' }}>
                          {providerInfo.active_requests} requests
                        </span>
                      )}
                      <span style={{ fontSize: '12px', color: statusColor, fontWeight: '600' }}>
                        {providerInfo.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ 
                    marginTop: '4px',
                    fontSize: '11px',
                    color: '#666'
                  }}>
                    Updated {formatTimeAgo(providerInfo.last_update)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      
      {/* Supported Feeds */}
      {showFeeds && supportedFeeds && (
        <div style={{ marginTop: '16px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
            Supported Data Feeds
          </h4>
          
          <div style={{ display: 'grid', gap: '12px' }}>
            {Object.entries(supportedFeeds).map(([providerKey, categories]) => {
              if (provider && provider !== providerKey) return null
              
              return (
                <div key={providerKey}>
                  <div style={{ 
                    fontWeight: '500',
                    marginBottom: '8px',
                    textTransform: 'capitalize',
                    color: '#1a1a1a'
                  }}>
                    {providerKey}
                  </div>
                  
                  <div style={{ display: 'grid', gap: '6px', marginLeft: '16px' }}>
                    {Object.entries(categories as Record<string, string[]>).map(([category, feeds]) => (
                      <div key={category}>
                        <div style={{ 
                          fontSize: '12px',
                          fontWeight: '500',
                          color: '#666',
                          marginBottom: '4px',
                          textTransform: 'uppercase'
                        }}>
                          {category}
                        </div>
                        <div style={{ 
                          fontSize: '11px',
                          color: '#666',
                          marginLeft: '12px'
                        }}>
                          {Array.isArray(feeds) ? feeds.join(', ') : feeds}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Quick status indicator component
export interface OracleStatusIndicatorProps {
  size?: 'small' | 'medium' | 'large'
  showLabel?: boolean
  className?: string
  style?: React.CSSProperties
}

export const OracleStatusIndicator: React.FC<OracleStatusIndicatorProps> = ({
  size = 'medium',
  showLabel = false,
  className,
  style
}) => {
  const { health, isHealthy, isLoading } = useOracle()
  
  const sizeMap = {
    small: '8px',
    medium: '12px',
    large: '16px'
  }
  
  const getColor = () => {
    if (isLoading) return '#6c757d'
    if (!health) return '#dc3545'
    return isHealthy ? '#28a745' : '#ffc107'
  }
  
  const getLabel = () => {
    if (isLoading) return 'Checking...'
    if (!health) return 'Offline'
    return health.overall_status
  }
  
  return (
    <div 
      className={className}
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '6px',
        ...style 
      }}
    >
      <div
        style={{
          width: sizeMap[size],
          height: sizeMap[size],
          borderRadius: '50%',
          backgroundColor: getColor(),
          animation: isLoading ? 'pulse 1s ease-in-out infinite' : undefined
        }}
      />
      {showLabel && (
        <span style={{ 
          fontSize: size === 'small' ? '11px' : '12px',
          color: '#666',
          textTransform: 'capitalize'
        }}>
          {getLabel()}
        </span>
      )}
      
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}