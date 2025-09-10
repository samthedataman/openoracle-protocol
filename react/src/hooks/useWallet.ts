import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type {
  ConnectedWallet,
  WalletConfig,
  WalletError,
  SupportedWallet,
  TransactionRequest,
  TransactionResponse,
  PendingTransaction,
  Token,
  SUPPORTED_NETWORKS,
  NetworkConfig
} from '../types'

// Mock wallet implementation - in a real app you'd integrate with wagmi, ethers, or similar
interface WalletAdapter {
  connect(): Promise<string>
  disconnect(): Promise<void>
  getAddress(): Promise<string>
  getBalance(): Promise<string>
  getNetwork(): Promise<number>
  switchNetwork(chainId: number): Promise<void>
  sendTransaction(tx: TransactionRequest): Promise<TransactionResponse>
  signMessage(message: string): Promise<string>
  signTypedData(data: any): Promise<string>
  isConnected(): boolean
  on(event: string, handler: (...args: any[]) => void): void
  off(event: string, handler: (...args: any[]) => void): void
}

// ============ Supported Wallets Configuration ============

const SUPPORTED_WALLETS: SupportedWallet[] = [
  {
    id: 'metamask',
    name: 'MetaMask',
    icon: '/wallets/metamask.svg',
    connector: 'injected',
    installed: typeof window !== 'undefined' && !!window.ethereum?.isMetaMask,
    downloadUrl: 'https://metamask.io/download/'
  },
  {
    id: 'walletconnect',
    name: 'WalletConnect',
    icon: '/wallets/walletconnect.svg',
    connector: 'walletconnect',
    installed: true, // Always available
  },
  {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    icon: '/wallets/coinbase.svg',
    connector: 'coinbase',
    installed: typeof window !== 'undefined' && !!window.ethereum?.isCoinbaseWallet,
    downloadUrl: 'https://www.coinbase.com/wallet'
  }
]

// ============ Wallet Hook State ============

interface WalletState {
  wallet: ConnectedWallet | null
  isConnecting: boolean
  error: WalletError | null
  pendingTransactions: PendingTransaction[]
  networkError: boolean
}

// ============ Main Wallet Hook ============

export interface UseWalletOptions {
  autoConnect?: boolean
  onConnect?: (wallet: ConnectedWallet) => void
  onDisconnect?: () => void
  onNetworkChange?: (network: number) => void
  onError?: (error: WalletError) => void
}

export interface UseWalletReturn {
  // Wallet state
  wallet: ConnectedWallet | null
  isConnected: boolean
  isConnecting: boolean
  error: WalletError | null
  networkError: boolean
  supportedWallets: SupportedWallet[]
  pendingTransactions: PendingTransaction[]
  
  // Connection actions
  connect: (walletId?: string) => Promise<void>
  disconnect: () => Promise<void>
  
  // Network actions
  switchNetwork: (chainId: number) => Promise<void>
  addNetwork: (network: NetworkConfig) => Promise<void>
  
  // Transaction actions
  sendTransaction: (tx: TransactionRequest) => Promise<TransactionResponse>
  signMessage: (message: string) => Promise<string>
  signTypedData: (data: any) => Promise<string>
  
  // Utility actions
  addToken: (token: Token) => Promise<void>
  getTokenBalance: (tokenAddress: string) => Promise<string>
  
  // Transaction tracking
  addPendingTransaction: (tx: PendingTransaction) => void
  removePendingTransaction: (hash: string) => void
}

let mockWalletAdapter: WalletAdapter | null = null

export const useWallet = (options: UseWalletOptions = {}): UseWalletReturn => {
  const queryClient = useQueryClient()
  
  const [state, setState] = useState<WalletState>({
    wallet: null,
    isConnecting: false,
    error: null,
    pendingTransactions: [],
    networkError: false
  })
  
  // Initialize wallet adapter (in real implementation, use wagmi or similar)
  const initializeAdapter = useCallback(async (walletId: string): Promise<WalletAdapter> => {
    // Mock implementation - replace with actual wallet connector
    const mockAdapter: WalletAdapter = {
      async connect() {
        await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate connection delay
        return '0x742d35Cc6634C0532925a3b8D497943e7f163417' // Mock address
      },
      async disconnect() {
        await new Promise(resolve => setTimeout(resolve, 500))
      },
      async getAddress() {
        return '0x742d35Cc6634C0532925a3b8D497943e7f163417'
      },
      async getBalance() {
        return '1.5' // Mock balance
      },
      async getNetwork() {
        return 545 // Flow EVM Testnet
      },
      async switchNetwork(chainId: number) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      },
      async sendTransaction(tx: TransactionRequest) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        return {
          hash: '0x' + Math.random().toString(16).substr(2, 40),
          wait: async () => ({
            transactionHash: '0x' + Math.random().toString(16).substr(2, 40),
            blockNumber: Math.floor(Math.random() * 1000000),
            gasUsed: '21000',
            status: 1
          })
        }
      },
      async signMessage(message: string) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        return '0x' + Math.random().toString(16).substr(2, 130)
      },
      async signTypedData(data: any) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        return '0x' + Math.random().toString(16).substr(2, 130)
      },
      isConnected() {
        return !!state.wallet
      },
      on(event: string, handler: (...args: any[]) => void) {
        // Mock event listener
      },
      off(event: string, handler: (...args: any[]) => void) {
        // Mock event listener removal
      }
    }
    
    mockWalletAdapter = mockAdapter
    return mockAdapter
  }, [state.wallet])
  
  // Connection methods
  const connect = useCallback(async (walletId: string = 'metamask') => {
    try {
      setState(prev => ({ ...prev, isConnecting: true, error: null }))
      
      const adapter = await initializeAdapter(walletId)
      const address = await adapter.connect()
      const balance = await adapter.getBalance()
      const network = await adapter.getNetwork()
      
      const networkInfo = SUPPORTED_NETWORKS[network]
      if (!networkInfo) {
        throw new Error(`Unsupported network: ${network}`)
      }
      
      const wallet: ConnectedWallet = {
        address,
        balance,
        network,
        networkName: networkInfo.name,
        connector: walletId,
        isConnected: true,
        isConnecting: false,
        isReconnecting: false,
        isDisconnected: false
      }
      
      setState(prev => ({
        ...prev,
        wallet,
        isConnecting: false,
        error: null,
        networkError: false
      }))
      
      // Store connection for auto-connect
      localStorage.setItem('wallet_connection', JSON.stringify({ walletId, address }))
      
      options.onConnect?.(wallet)
      
    } catch (error) {
      const walletError = error as WalletError
      setState(prev => ({ 
        ...prev, 
        isConnecting: false, 
        error: walletError 
      }))
      options.onError?.(walletError)
      throw error
    }
  }, [initializeAdapter, options])
  
  const disconnect = useCallback(async () => {
    try {
      if (mockWalletAdapter) {
        await mockWalletAdapter.disconnect()
      }
      
      setState(prev => ({
        ...prev,
        wallet: null,
        error: null,
        networkError: false,
        pendingTransactions: []
      }))
      
      // Clear stored connection
      localStorage.removeItem('wallet_connection')
      
      // Clear cached data
      queryClient.clear()
      
      options.onDisconnect?.()
      
    } catch (error) {
      console.error('Disconnect error:', error)
    }
  }, [queryClient, options])
  
  // Network methods
  const switchNetwork = useCallback(async (chainId: number) => {
    if (!mockWalletAdapter || !state.wallet) {
      throw new Error('Wallet not connected')
    }
    
    try {
      await mockWalletAdapter.switchNetwork(chainId)
      
      const networkInfo = SUPPORTED_NETWORKS[chainId]
      if (!networkInfo) {
        throw new Error(`Unsupported network: ${chainId}`)
      }
      
      setState(prev => ({
        ...prev,
        wallet: prev.wallet ? {
          ...prev.wallet,
          network: chainId,
          networkName: networkInfo.name
        } : null,
        networkError: false
      }))
      
      options.onNetworkChange?.(chainId)
      
    } catch (error) {
      setState(prev => ({ ...prev, networkError: true }))
      throw error
    }
  }, [state.wallet, options])
  
  const addNetwork = useCallback(async (network: NetworkConfig) => {
    if (!window.ethereum) {
      throw new Error('No wallet provider found')
    }
    
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: `0x${network.chainId.toString(16)}`,
          chainName: network.name,
          nativeCurrency: network.nativeCurrency,
          rpcUrls: network.rpcUrls,
          blockExplorerUrls: network.blockExplorerUrls
        }]
      })
    } catch (error) {
      throw new Error(`Failed to add network: ${error.message}`)
    }
  }, [])
  
  // Transaction methods
  const sendTransaction = useCallback(async (tx: TransactionRequest) => {
    if (!mockWalletAdapter || !state.wallet) {
      throw new Error('Wallet not connected')
    }
    
    const response = await mockWalletAdapter.sendTransaction(tx)
    
    // Add to pending transactions
    const pendingTx: PendingTransaction = {
      hash: response.hash,
      type: 'bet', // This would be determined based on the transaction
      description: 'Transaction pending...',
      timestamp: Date.now()
    }
    
    setState(prev => ({
      ...prev,
      pendingTransactions: [...prev.pendingTransactions, pendingTx]
    }))
    
    // Wait for confirmation and remove from pending
    response.wait().then(() => {
      setState(prev => ({
        ...prev,
        pendingTransactions: prev.pendingTransactions.filter(tx => tx.hash !== response.hash)
      }))
    }).catch(console.error)
    
    return response
  }, [state.wallet])
  
  const signMessage = useCallback(async (message: string) => {
    if (!mockWalletAdapter || !state.wallet) {
      throw new Error('Wallet not connected')
    }
    
    return mockWalletAdapter.signMessage(message)
  }, [state.wallet])
  
  const signTypedData = useCallback(async (data: any) => {
    if (!mockWalletAdapter || !state.wallet) {
      throw new Error('Wallet not connected')
    }
    
    return mockWalletAdapter.signTypedData(data)
  }, [state.wallet])
  
  // Utility methods
  const addToken = useCallback(async (token: Token) => {
    if (!window.ethereum) {
      throw new Error('No wallet provider found')
    }
    
    try {
      await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: token.address,
            symbol: token.symbol,
            decimals: token.decimals,
            image: token.logoUrl
          }
        }
      })
    } catch (error) {
      throw new Error(`Failed to add token: ${error.message}`)
    }
  }, [])
  
  const getTokenBalance = useCallback(async (tokenAddress: string): Promise<string> => {
    if (!mockWalletAdapter || !state.wallet) {
      throw new Error('Wallet not connected')
    }
    
    // Mock token balance - in real implementation, call contract
    return '100.0'
  }, [state.wallet])
  
  // Transaction tracking
  const addPendingTransaction = useCallback((tx: PendingTransaction) => {
    setState(prev => ({
      ...prev,
      pendingTransactions: [...prev.pendingTransactions, tx]
    }))
  }, [])
  
  const removePendingTransaction = useCallback((hash: string) => {
    setState(prev => ({
      ...prev,
      pendingTransactions: prev.pendingTransactions.filter(tx => tx.hash !== hash)
    }))
  }, [])
  
  // Auto-connect on mount
  useEffect(() => {
    if (options.autoConnect) {
      const stored = localStorage.getItem('wallet_connection')
      if (stored) {
        try {
          const { walletId } = JSON.parse(stored)
          connect(walletId).catch(console.error)
        } catch (error) {
          console.error('Auto-connect failed:', error)
        }
      }
    }
  }, [options.autoConnect, connect])
  
  return {
    // State
    wallet: state.wallet,
    isConnected: !!state.wallet,
    isConnecting: state.isConnecting,
    error: state.error,
    networkError: state.networkError,
    supportedWallets: SUPPORTED_WALLETS,
    pendingTransactions: state.pendingTransactions,
    
    // Actions
    connect,
    disconnect,
    switchNetwork,
    addNetwork,
    sendTransaction,
    signMessage,
    signTypedData,
    addToken,
    getTokenBalance,
    addPendingTransaction,
    removePendingTransaction
  }
}