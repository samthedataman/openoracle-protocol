// ============ Wallet Connection Types ============

export interface WalletConfig {
  autoConnect?: boolean
  supportedNetworks?: number[]
  preferredNetwork?: number
  walletConnectProjectId?: string
}

export interface ConnectedWallet {
  address: string
  balance: string
  network: number
  networkName: string
  connector: string
  isConnected: boolean
  isConnecting: boolean
  isReconnecting: boolean
  isDisconnected: boolean
}

export interface WalletError extends Error {
  code?: string | number
  reason?: string
  data?: any
}

export interface SupportedWallet {
  id: string
  name: string
  icon: string
  connector: string
  installed?: boolean
  downloadUrl?: string
}

// ============ Transaction Types ============

export interface TransactionRequest {
  to: string
  value?: string
  data?: string
  gasLimit?: string
  gasPrice?: string
  nonce?: number
}

export interface TransactionResponse {
  hash: string
  wait: () => Promise<TransactionReceipt>
}

export interface TransactionReceipt {
  transactionHash: string
  blockNumber: number
  gasUsed: string
  status: number
  events?: any[]
}

export interface PendingTransaction {
  hash: string
  type: 'bet' | 'create_poll' | 'resolve_poll' | 'withdraw'
  description: string
  timestamp: number
}

// ============ Network Types ============

export interface NetworkConfig {
  chainId: number
  name: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  rpcUrls: string[]
  blockExplorerUrls: string[]
  iconUrl?: string
}

export const SUPPORTED_NETWORKS: Record<number, NetworkConfig> = {
  545: {
    chainId: 545,
    name: 'Flow EVM Testnet',
    nativeCurrency: {
      name: 'Flow',
      symbol: 'FLOW',
      decimals: 18
    },
    rpcUrls: ['https://testnet.evm.nodes.onflow.org'],
    blockExplorerUrls: ['https://evm-testnet.flowscan.io/'],
    iconUrl: '/flow-icon.svg'
  },
  8453: {
    chainId: 8453,
    name: 'Base',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrls: ['https://mainnet.base.org'],
    blockExplorerUrls: ['https://basescan.org/'],
    iconUrl: '/base-icon.svg'
  },
  1: {
    chainId: 1,
    name: 'Ethereum',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrls: ['https://eth-mainnet.g.alchemy.com/v2/api-key'],
    blockExplorerUrls: ['https://etherscan.io/'],
    iconUrl: '/ethereum-icon.svg'
  }
}

// ============ Token Types ============

export interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
  logoUrl?: string
  balance?: string
}

export interface TokenBalance {
  token: Token
  balance: string
  balanceFormatted: string
  balanceUSD?: number
}

// ============ Wallet Hook State ============

export interface WalletState {
  wallet: ConnectedWallet | null
  isConnecting: boolean
  error: WalletError | null
  supportedWallets: SupportedWallet[]
  pendingTransactions: PendingTransaction[]
  networkError: boolean
}

export interface WalletActions {
  connect: (walletId?: string) => Promise<void>
  disconnect: () => Promise<void>
  switchNetwork: (chainId: number) => Promise<void>
  sendTransaction: (tx: TransactionRequest) => Promise<TransactionResponse>
  signMessage: (message: string) => Promise<string>
  signTypedData: (data: any) => Promise<string>
  addToken: (token: Token) => Promise<void>
  getTokenBalance: (tokenAddress: string) => Promise<string>
}