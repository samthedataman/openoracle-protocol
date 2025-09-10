// Main exports for @openoracle/react SDK

// Types
export * from './types'

// Hooks
export * from './hooks/useOracle'
export * from './hooks/useMarkets'  
export * from './hooks/useTwitter'
export * from './hooks/useWallet'

// Providers
export * from './providers/OracleProvider'
export * from './providers/WalletProvider'
export * from './providers/MarketProvider'

// Components
export * from './components/MarketCard'
export * from './components/OracleStatus'
export * from './components/PriceDisplay'

// Services
export { createAPI, getDefaultAPI, setDefaultAPI, isApiError, handleApiError } from './services/api'

// Utils
export * from './utils'

// Version
export const VERSION = '1.0.0'

// Default export for convenience
import { OracleProvider } from './providers/OracleProvider'
import { WalletProvider } from './providers/WalletProvider'
import { MarketProvider } from './providers/MarketProvider'
import { useOracle } from './hooks/useOracle'
import { useMarkets } from './hooks/useMarkets'
import { useTwitter } from './hooks/useTwitter'
import { useWallet } from './hooks/useWallet'

export default {
  // Providers
  OracleProvider,
  WalletProvider,
  MarketProvider,
  
  // Hooks
  useOracle,
  useMarkets,
  useTwitter,
  useWallet,
  
  // Version
  VERSION
}