import { Decimal } from 'decimal.js'
import type { Poll, UserPosition } from '../types'

// ============ Oracle Calculations ============

export const calculateOracleConfidence = (
  providers: string[],
  individualConfidences: Record<string, number>
): number => {
  if (providers.length === 0) return 0
  
  // Weight different providers based on reliability
  const providerWeights: Record<string, number> = {
    chainlink: 1.0,
    pyth: 0.9,
    band: 0.8,
    uma: 0.7,
    api3: 0.8
  }
  
  let totalWeight = 0
  let weightedSum = 0
  
  providers.forEach(provider => {
    const weight = providerWeights[provider] || 0.5
    const confidence = individualConfidences[provider] || 0
    
    totalWeight += weight
    weightedSum += confidence * weight
  })
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0
}

export const calculatePriceDiscrepancy = (
  prices: Record<string, number>
): {
  hasDiscrepancy: boolean
  maxDiscrepancy: number
  avgPrice: number
  outliers: string[]
} => {
  const priceValues = Object.values(prices).filter(price => price > 0)
  if (priceValues.length === 0) {
    return { hasDiscrepancy: false, maxDiscrepancy: 0, avgPrice: 0, outliers: [] }
  }
  
  const avgPrice = priceValues.reduce((sum, price) => sum + price, 0) / priceValues.length
  const discrepancies = Object.entries(prices).map(([provider, price]) => ({
    provider,
    discrepancy: Math.abs(price - avgPrice) / avgPrice
  }))
  
  const maxDiscrepancy = Math.max(...discrepancies.map(d => d.discrepancy))
  const hasDiscrepancy = maxDiscrepancy > 0.05 // 5% threshold
  
  // Find outliers (more than 10% deviation)
  const outliers = discrepancies
    .filter(d => d.discrepancy > 0.1)
    .map(d => d.provider)
  
  return {
    hasDiscrepancy,
    maxDiscrepancy,
    avgPrice,
    outliers
  }
}

// ============ Market Calculations ============

export const calculateImpliedProbability = (
  option: { votes: number },
  totalVotes: number
): number => {
  if (totalVotes === 0) return 0
  return option.votes / totalVotes
}

export const calculateOdds = (probability: number): number => {
  if (probability <= 0 || probability >= 1) return 0
  return 1 / probability
}

export const calculatePayout = (
  betAmount: number,
  probability: number,
  houseEdge: number = 0.02 // 2% house edge
): number => {
  if (probability <= 0 || probability >= 1) return betAmount
  
  const odds = calculateOdds(probability)
  const netOdds = odds * (1 - houseEdge)
  
  return betAmount * netOdds
}

export const calculateTimeWeightedMultiplier = (
  betTimestamp: string | number,
  pollCreatedAt: string | number,
  pollExpiresAt?: string | number,
  maxMultiplier: number = 2.0,
  minMultiplier: number = 1.0
): number => {
  const betTime = typeof betTimestamp === 'string' ? new Date(betTimestamp).getTime() : betTimestamp
  const createdTime = typeof pollCreatedAt === 'string' ? new Date(pollCreatedAt).getTime() : pollCreatedAt
  const expiresTime = pollExpiresAt 
    ? (typeof pollExpiresAt === 'string' ? new Date(pollExpiresAt).getTime() : pollExpiresAt)
    : createdTime + (7 * 24 * 60 * 60 * 1000) // Default 7 days
  
  const totalDuration = expiresTime - createdTime
  const timeElapsed = betTime - createdTime
  const timeRemaining = expiresTime - betTime
  
  if (totalDuration <= 0 || timeRemaining <= 0) return minMultiplier
  
  // Early bets get higher multipliers
  const timeRatio = timeRemaining / totalDuration
  const multiplier = minMultiplier + (maxMultiplier - minMultiplier) * Math.pow(timeRatio, 2)
  
  return Math.min(Math.max(multiplier, minMultiplier), maxMultiplier)
}

export const calculateMarketDepth = (options: Array<{ votes: number; payout_multiplier?: number }>): {
  depth: number
  liquidity: number
  balance: number
} => {
  const totalVotes = options.reduce((sum, option) => sum + option.votes, 0)
  
  if (totalVotes === 0) {
    return { depth: 0, liquidity: 0, balance: 1 }
  }
  
  // Calculate market balance (how evenly distributed the bets are)
  const probabilities = options.map(option => option.votes / totalVotes)
  const entropy = -probabilities.reduce((sum, p) => sum + (p > 0 ? p * Math.log2(p) : 0), 0)
  const maxEntropy = Math.log2(options.length)
  const balance = maxEntropy > 0 ? entropy / maxEntropy : 0
  
  // Depth is based on total volume
  const depth = Math.log10(totalVotes + 1) // Logarithmic scale
  
  // Liquidity considers both volume and balance
  const liquidity = depth * balance
  
  return { depth, liquidity, balance }
}

// ============ Portfolio Calculations ============

export const calculatePortfolioValue = (positions: UserPosition[]): {
  totalValue: number
  totalInvested: number
  totalPnL: number
  pnlPercentage: number
  openPositions: number
  closedPositions: number
} => {
  let totalValue = 0
  let totalInvested = 0
  let openPositions = 0
  let closedPositions = 0
  
  positions.forEach(position => {
    totalInvested += position.amount_invested
    totalValue += position.current_value
    
    if (position.status === 'open') {
      openPositions++
    } else {
      closedPositions++
    }
  })
  
  const totalPnL = totalValue - totalInvested
  const pnlPercentage = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0
  
  return {
    totalValue,
    totalInvested,
    totalPnL,
    pnlPercentage,
    openPositions,
    closedPositions
  }
}

export const calculatePositionReturn = (position: UserPosition): {
  returnAmount: number
  returnPercentage: number
  multiplier: number
} => {
  const returnAmount = position.current_value - position.amount_invested
  const returnPercentage = position.amount_invested > 0 
    ? (returnAmount / position.amount_invested) * 100 
    : 0
  const multiplier = position.amount_invested > 0 
    ? position.current_value / position.amount_invested 
    : 0
  
  return { returnAmount, returnPercentage, multiplier }
}

export const calculateRiskMetrics = (positions: UserPosition[]): {
  totalRisk: number
  diversification: number
  avgReturnPercentage: number
  volatility: number
  sharpeRatio: number
} => {
  if (positions.length === 0) {
    return { totalRisk: 0, diversification: 0, avgReturnPercentage: 0, volatility: 0, sharpeRatio: 0 }
  }
  
  const returns = positions.map(p => calculatePositionReturn(p).returnPercentage)
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
  
  // Calculate volatility (standard deviation of returns)
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  const volatility = Math.sqrt(variance)
  
  // Simple Sharpe ratio (assuming 0% risk-free rate)
  const sharpeRatio = volatility > 0 ? avgReturn / volatility : 0
  
  // Total risk is sum of position sizes weighted by their volatility
  const totalValue = positions.reduce((sum, p) => sum + p.current_value, 0)
  const totalRisk = totalValue > 0 
    ? positions.reduce((sum, p) => sum + (p.current_value / totalValue) * Math.abs(calculatePositionReturn(p).returnPercentage), 0)
    : 0
  
  // Diversification: inverse of concentration (Herfindahl index)
  const concentrationIndex = positions.reduce((sum, p) => {
    const weight = totalValue > 0 ? p.current_value / totalValue : 0
    return sum + Math.pow(weight, 2)
  }, 0)
  const diversification = positions.length > 1 ? (1 - concentrationIndex) * positions.length / (positions.length - 1) : 0
  
  return {
    totalRisk,
    diversification,
    avgReturnPercentage: avgReturn,
    volatility,
    sharpeRatio
  }
}

// ============ Market Making Calculations ============

export const calculateSlippage = (
  orderSize: number,
  availableLiquidity: number,
  impactFactor: number = 0.1
): number => {
  if (availableLiquidity === 0) return 1 // 100% slippage
  
  const liquidityRatio = orderSize / availableLiquidity
  
  // Quadratic slippage model
  return Math.min(liquidityRatio * liquidityRatio * impactFactor, 1)
}

export const calculateOptimalBetSize = (
  bankroll: number,
  probability: number,
  odds: number,
  kellyFraction: number = 0.25 // Conservative Kelly fraction
): number => {
  if (probability <= 0 || odds <= 1) return 0
  
  const edge = probability * odds - 1
  if (edge <= 0) return 0
  
  // Kelly criterion
  const kellySize = edge / (odds - 1)
  
  // Apply fractional Kelly for safety
  const optimalFraction = Math.min(kellySize * kellyFraction, 0.1) // Max 10% of bankroll
  
  return bankroll * optimalFraction
}

// ============ Technical Analysis ============

export const calculateMovingAverage = (
  prices: number[],
  period: number
): number[] => {
  if (prices.length < period) return []
  
  const result: number[] = []
  
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
    result.push(sum / period)
  }
  
  return result
}

export const calculateRSI = (
  prices: number[],
  period: number = 14
): number[] => {
  if (prices.length < period + 1) return []
  
  const changes = prices.slice(1).map((price, i) => price - prices[i])
  const gains = changes.map(change => Math.max(change, 0))
  const losses = changes.map(change => Math.max(-change, 0))
  
  let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period
  let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period
  
  const rsi: number[] = []
  
  for (let i = period; i < changes.length; i++) {
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    const rsiValue = 100 - (100 / (1 + rs))
    rsi.push(rsiValue)
    
    // Update averages for next iteration
    avgGain = ((avgGain * (period - 1)) + gains[i]) / period
    avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period
  }
  
  return rsi
}

// ============ Utility Functions ============

export const compoundDecimal = (value: Decimal, rate: Decimal, periods: number): Decimal => {
  return value.mul(rate.plus(1).pow(periods))
}

export const presentValue = (futureValue: number, rate: number, periods: number): number => {
  return futureValue / Math.pow(1 + rate, periods)
}

export const annualizeReturn = (totalReturn: number, holdingPeriodDays: number): number => {
  if (holdingPeriodDays <= 0) return 0
  
  const periodsPerYear = 365 / holdingPeriodDays
  return (Math.pow(1 + totalReturn, periodsPerYear) - 1) * 100
}