import React from 'react'
import { usePriceFeed } from '../hooks/useOracle'
import { formatCurrency, formatTimeAgo, formatPriceChange } from '../utils'
import type { OracleProvider, UsePriceFeedOptions } from '../types'

export interface PriceDisplayProps extends UsePriceFeedOptions {
  showProvider?: boolean
  showTimestamp?: boolean
  showChange?: boolean
  previousPrice?: number
  size?: 'small' | 'medium' | 'large'
  className?: string
  style?: React.CSSProperties
  onError?: (error: Error) => void
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  showProvider = true,
  showTimestamp = true,
  showChange = false,
  previousPrice,
  size = 'medium',
  className,
  style,
  onError,
  ...priceFeedOptions
}) => {
  const { data: priceData, isLoading, error, refetch } = usePriceFeed(priceFeedOptions)
  
  React.useEffect(() => {
    if (error && onError) {
      onError(error)
    }
  }, [error, onError])
  
  const sizeStyles = {
    small: {
      price: { fontSize: '16px', fontWeight: '600' },
      label: { fontSize: '12px' },
      meta: { fontSize: '10px' }
    },
    medium: {
      price: { fontSize: '24px', fontWeight: '600' },
      label: { fontSize: '14px' },
      meta: { fontSize: '12px' }
    },
    large: {
      price: { fontSize: '32px', fontWeight: '600' },
      label: { fontSize: '16px' },
      meta: { fontSize: '14px' }
    }
  }
  
  const currentStyles = sizeStyles[size]
  
  if (isLoading) {
    return (
      <div className={className} style={style}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ 
            width: size === 'small' ? '16px' : size === 'medium' ? '20px' : '24px',
            height: size === 'small' ? '16px' : size === 'medium' ? '20px' : '24px',
            border: '2px solid #f3f3f3',
            borderTop: '2px solid #007acc',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <span style={{ ...currentStyles.label, color: '#666' }}>
            Loading price...
          </span>
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
  
  if (error) {
    return (
      <div className={className} style={style}>
        <div style={{
          padding: size === 'small' ? '8px' : '12px',
          background: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '6px',
          textAlign: 'center'
        }}>
          <div style={{ ...currentStyles.label, color: '#856404', marginBottom: '4px' }}>
            Price Unavailable
          </div>
          <button
            onClick={() => refetch()}
            style={{
              padding: '4px 8px',
              background: 'transparent',
              border: '1px solid #856404',
              borderRadius: '4px',
              color: '#856404',
              fontSize: '10px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }
  
  if (!priceData) {
    return (
      <div className={className} style={style}>
        <div style={{ ...currentStyles.label, color: '#666' }}>
          No price data available
        </div>
      </div>
    )
  }
  
  // Handle different response formats
  const price = typeof priceData.price === 'string' 
    ? parseFloat(priceData.price) 
    : priceData.price
  
  const symbol = (priceData as any).symbol || (priceData as any).pair || 'Price'
  const timestamp = priceData.timestamp
  const provider = (priceData as any).provider
  const confidence = (priceData as any).confidence
  
  // Calculate price change if previous price provided
  const priceChange = showChange && previousPrice && previousPrice !== price
    ? formatPriceChange(price, previousPrice, true)
    : null
  
  const changeColor = priceChange && priceChange.startsWith('+') ? '#28a745' : 
                     priceChange && priceChange.startsWith('-') ? '#dc3545' : '#666'
  
  return (
    <div className={className} style={style}>
      {/* Main Price Display */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
        <div style={{ ...currentStyles.price, color: '#1a1a1a' }}>
          {formatCurrency(price)}
        </div>
        
        {priceChange && (
          <div style={{ 
            ...currentStyles.meta,
            color: changeColor,
            fontWeight: '600'
          }}>
            {priceChange}
          </div>
        )}
      </div>
      
      {/* Symbol/Pair Label */}
      <div style={{ 
        ...currentStyles.label,
        color: '#666',
        marginBottom: '4px'
      }}>
        {symbol}
      </div>
      
      {/* Metadata */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        {showProvider && provider && (
          <span style={{ 
            ...currentStyles.meta,
            background: '#f0f0f0',
            padding: '2px 6px',
            borderRadius: '4px',
            color: '#666',
            textTransform: 'uppercase',
            fontWeight: '500'
          }}>
            {provider}
          </span>
        )}
        
        {confidence !== undefined && (
          <span style={{ 
            ...currentStyles.meta,
            color: confidence > 0.8 ? '#28a745' : confidence > 0.6 ? '#ffc107' : '#dc3545',
            fontWeight: '500'
          }}>
            {(confidence * 100).toFixed(0)}% confidence
          </span>
        )}
        
        {showTimestamp && timestamp && (
          <span style={{ ...currentStyles.meta, color: '#999' }}>
            {formatTimeAgo(timestamp)}
          </span>
        )}
      </div>
    </div>
  )
}

// Multi-provider price comparison component
export interface PriceComparisonProps {
  asset: string
  providers?: OracleProvider[]
  className?: string
  style?: React.CSSProperties
}

export const PriceComparison: React.FC<PriceComparisonProps> = ({
  asset,
  providers = ['chainlink', 'pyth'],
  className,
  style
}) => {
  const prices = providers.map(provider => ({
    provider,
    query: usePriceFeed({ 
      provider: provider as any, 
      pair: asset,
      symbol: asset 
    })
  }))
  
  const allLoaded = prices.every(p => !p.query.isLoading)
  const hasErrors = prices.some(p => p.query.error)
  
  if (!allLoaded) {
    return (
      <div className={className} style={style}>
        <div style={{ textAlign: 'center', padding: '16px' }}>
          Loading price comparison...
        </div>
      </div>
    )
  }
  
  const validPrices = prices
    .filter(p => p.query.data && !p.query.error)
    .map(p => ({
      provider: p.provider,
      price: typeof p.query.data!.price === 'string' 
        ? parseFloat(p.query.data!.price) 
        : p.query.data!.price,
      timestamp: p.query.data!.timestamp
    }))
  
  if (validPrices.length === 0) {
    return (
      <div className={className} style={style}>
        <div style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
          No price data available for {asset}
        </div>
      </div>
    )
  }
  
  const avgPrice = validPrices.reduce((sum, p) => sum + p.price, 0) / validPrices.length
  const maxDeviation = Math.max(...validPrices.map(p => Math.abs(p.price - avgPrice) / avgPrice))
  const hasDiscrepancy = maxDeviation > 0.02 // 2% threshold
  
  return (
    <div className={className} style={style}>
      <div style={{ marginBottom: '12px' }}>
        <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600' }}>
          {asset} Price Comparison
        </h4>
        <div style={{ fontSize: '12px', color: '#666' }}>
          Average: {formatCurrency(avgPrice)}
          {hasDiscrepancy && (
            <span style={{ color: '#ffc107', marginLeft: '8px' }}>
              ⚠️ Price discrepancy detected
            </span>
          )}
        </div>
      </div>
      
      <div style={{ display: 'grid', gap: '8px' }}>
        {validPrices.map(({ provider, price, timestamp }) => {
          const deviation = Math.abs(price - avgPrice) / avgPrice
          const deviationColor = deviation > 0.02 ? '#dc3545' : deviation > 0.01 ? '#ffc107' : '#28a745'
          
          return (
            <div
              key={provider}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                border: '1px solid #e1e5e9',
                borderRadius: '6px',
                background: '#f8f9fa'
              }}
            >
              <div>
                <div style={{ 
                  fontWeight: '500',
                  textTransform: 'capitalize',
                  marginBottom: '2px'
                }}>
                  {provider}
                </div>
                <div style={{ fontSize: '11px', color: '#666' }}>
                  {formatTimeAgo(timestamp)}
                </div>
              </div>
              
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>
                  {formatCurrency(price)}
                </div>
                <div style={{ 
                  fontSize: '10px',
                  color: deviationColor,
                  fontWeight: '500'
                }}>
                  {deviation > 0.001 ? `±${(deviation * 100).toFixed(1)}%` : 'On target'}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}