import { format, formatDistanceToNow, formatRelative, isValid } from 'date-fns'

// ============ Number Formatting ============

export const formatNumber = (value: number, options?: Intl.NumberFormatOptions): string => {
  return new Intl.NumberFormat('en-US', options).format(value)
}

export const formatCurrency = (
  value: number, 
  currency: string = 'USD',
  minimumFractionDigits: number = 2
): string => {
  return formatNumber(value, {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits: Math.max(minimumFractionDigits, 6)
  })
}

export const formatPercentage = (
  value: number,
  minimumFractionDigits: number = 1,
  maximumFractionDigits: number = 2
): string => {
  return formatNumber(value, {
    style: 'percent',
    minimumFractionDigits,
    maximumFractionDigits
  })
}

export const formatCompactNumber = (value: number): string => {
  if (value >= 1e9) {
    return formatNumber(value / 1e9, { maximumFractionDigits: 1 }) + 'B'
  }
  if (value >= 1e6) {
    return formatNumber(value / 1e6, { maximumFractionDigits: 1 }) + 'M'
  }
  if (value >= 1e3) {
    return formatNumber(value / 1e3, { maximumFractionDigits: 1 }) + 'K'
  }
  return formatNumber(value, { maximumFractionDigits: 0 })
}

export const formatCryptoAmount = (
  value: number | string,
  decimals: number = 18,
  displayDecimals: number = 4
): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) return '0'
  
  const divisor = Math.pow(10, decimals)
  const converted = numValue / divisor
  
  return formatNumber(converted, {
    minimumFractionDigits: 0,
    maximumFractionDigits: displayDecimals
  })
}

// ============ Date/Time Formatting ============

export const formatDate = (
  date: string | Date,
  formatString: string = 'MMM dd, yyyy'
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  if (!isValid(dateObj)) return 'Invalid date'
  
  return format(dateObj, formatString)
}

export const formatDateTime = (date: string | Date): string => {
  return formatDate(date, 'MMM dd, yyyy HH:mm')
}

export const formatTimeAgo = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  if (!isValid(dateObj)) return 'Invalid date'
  
  return formatDistanceToNow(dateObj, { addSuffix: true })
}

export const formatRelativeTime = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  if (!isValid(dateObj)) return 'Invalid date'
  
  return formatRelative(dateObj, new Date())
}

export const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) {
    return `${days}d ${hours % 24}h`
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}

// ============ Address Formatting ============

export const formatAddress = (
  address: string,
  startChars: number = 6,
  endChars: number = 4
): string => {
  if (!address || address.length <= startChars + endChars) {
    return address || ''
  }
  
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}

export const formatTransactionHash = (hash: string): string => {
  return formatAddress(hash, 8, 8)
}

// ============ Market Data Formatting ============

export const formatOdds = (probability: number): string => {
  if (probability <= 0 || probability >= 1) return 'N/A'
  
  const decimal = 1 / probability
  if (decimal >= 2) {
    return `${decimal.toFixed(2)}`
  }
  
  // For very high probability bets, show as fractional odds
  const fraction = (1 - probability) / probability
  if (fraction < 1) {
    const inverted = 1 / fraction
    return `1:${inverted.toFixed(2)}`
  }
  
  return `${fraction.toFixed(2)}:1`
}

export const formatMultiplier = (multiplier: number): string => {
  return `${multiplier.toFixed(2)}x`
}

export const formatMarketCap = (value: number): string => {
  if (value >= 1e12) {
    return formatCurrency(value / 1e12, 'USD', 2) + 'T'
  }
  if (value >= 1e9) {
    return formatCurrency(value / 1e9, 'USD', 2) + 'B'
  }
  if (value >= 1e6) {
    return formatCurrency(value / 1e6, 'USD', 2) + 'M'
  }
  return formatCurrency(value)
}

export const formatVolume = (value: number): string => {
  return formatCompactNumber(value)
}

export const formatPriceChange = (
  current: number,
  previous: number,
  asPercentage: boolean = true
): string => {
  if (previous === 0) return 'N/A'
  
  const change = current - previous
  if (asPercentage) {
    const percentage = (change / previous) * 100
    const sign = percentage >= 0 ? '+' : ''
    return `${sign}${formatPercentage(percentage / 100)}`
  }
  
  const sign = change >= 0 ? '+' : ''
  return `${sign}${formatCurrency(change)}`
}

// ============ Text Formatting ============

export const formatSentiment = (sentiment: 'bullish' | 'bearish' | 'neutral' | 'positive' | 'negative'): {
  text: string
  color: string
  emoji: string
} => {
  const sentimentMap = {
    bullish: { text: 'Bullish', color: '#28a745', emoji: '📈' },
    bearish: { text: 'Bearish', color: '#dc3545', emoji: '📉' },
    neutral: { text: 'Neutral', color: '#6c757d', emoji: '➡️' },
    positive: { text: 'Positive', color: '#28a745', emoji: '😊' },
    negative: { text: 'Negative', color: '#dc3545', emoji: '😟' }
  }
  
  return sentimentMap[sentiment] || sentimentMap.neutral
}

export const formatConfidence = (confidence: number): {
  text: string
  color: string
  level: 'low' | 'medium' | 'high'
} => {
  const percentage = confidence * 100
  
  if (confidence >= 0.8) {
    return {
      text: `${percentage.toFixed(0)}% (High)`,
      color: '#28a745',
      level: 'high'
    }
  }
  
  if (confidence >= 0.6) {
    return {
      text: `${percentage.toFixed(0)}% (Medium)`,
      color: '#ffc107',
      level: 'medium'
    }
  }
  
  return {
    text: `${percentage.toFixed(0)}% (Low)`,
    color: '#dc3545',
    level: 'low'
  }
}

export const formatPollStatus = (poll: {
  resolved: boolean
  expires_at?: string
}): {
  text: string
  color: string
  status: 'active' | 'resolved' | 'expired'
} => {
  if (poll.resolved) {
    return {
      text: 'Resolved',
      color: '#28a745',
      status: 'resolved'
    }
  }
  
  if (poll.expires_at && new Date(poll.expires_at) < new Date()) {
    return {
      text: 'Expired',
      color: '#dc3545',
      status: 'expired'
    }
  }
  
  return {
    text: 'Active',
    color: '#007acc',
    status: 'active'
  }
}

// ============ Validation Helpers ============

export const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

export const isValidTransactionHash = (hash: string): boolean => {
  return /^0x[a-fA-F0-9]{64}$/.test(hash)
}

export const isValidAmount = (amount: string | number): boolean => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return !isNaN(num) && num > 0 && isFinite(num)
}