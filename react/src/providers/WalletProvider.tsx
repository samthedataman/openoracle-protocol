import React, { createContext, useContext, ReactNode } from 'react'
import { useWallet as useWalletHook } from '../hooks/useWallet'
import type { WalletConfig, UseWalletReturn } from '../types'

// ============ Wallet Context ============

export interface WalletContextValue extends UseWalletReturn {
  config: WalletConfig
}

const WalletContext = createContext<WalletContextValue | null>(null)

export const useWalletContext = (): WalletContextValue => {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWalletContext must be used within a WalletProvider')
  }
  return context
}

// ============ Wallet Provider Component ============

export interface WalletProviderProps {
  children: ReactNode
  config?: WalletConfig
}

const DEFAULT_CONFIG: WalletConfig = {
  autoConnect: true,
  supportedNetworks: [1, 8453, 545], // Ethereum, Base, Flow EVM
  preferredNetwork: 545 // Flow EVM Testnet
}

export const WalletProvider: React.FC<WalletProviderProps> = ({
  children,
  config = DEFAULT_CONFIG
}) => {
  const walletHook = useWalletHook({
    autoConnect: config.autoConnect,
    onConnect: (wallet) => {
      console.log('Wallet connected:', wallet.address)
      
      // Check if connected to supported network
      if (config.supportedNetworks && !config.supportedNetworks.includes(wallet.network)) {
        console.warn('Connected to unsupported network:', wallet.network)
      }
    },
    onDisconnect: () => {
      console.log('Wallet disconnected')
    },
    onNetworkChange: (network) => {
      console.log('Network changed:', network)
    },
    onError: (error) => {
      console.error('Wallet error:', error)
    }
  })
  
  const contextValue: WalletContextValue = {
    ...walletHook,
    config
  }
  
  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  )
}

// ============ Wallet Connection Component ============

export interface WalletConnectorProps {
  onConnect?: (address: string) => void
  onDisconnect?: () => void
  className?: string
  style?: React.CSSProperties
}

export const WalletConnector: React.FC<WalletConnectorProps> = ({
  onConnect,
  onDisconnect,
  className,
  style
}) => {
  const { 
    wallet, 
    isConnected, 
    isConnecting, 
    connect, 
    disconnect, 
    supportedWallets,
    error 
  } = useWalletContext()
  
  const handleConnect = async (walletId: string) => {
    try {
      await connect(walletId)
      if (wallet?.address) {
        onConnect?.(wallet.address)
      }
    } catch (error) {
      console.error('Connection failed:', error)
    }
  }
  
  const handleDisconnect = async () => {
    try {
      await disconnect()
      onDisconnect?.()
    } catch (error) {
      console.error('Disconnection failed:', error)
    }
  }
  
  if (isConnected && wallet) {
    return (
      <div className={className} style={style}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <div style={{ fontWeight: 'bold' }}>
              {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {wallet.networkName} • {Number(wallet.balance).toFixed(4)} ETH
            </div>
          </div>
          <button 
            onClick={handleDisconnect}
            style={{
              padding: '8px 16px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: 'white',
              cursor: 'pointer'
            }}
          >
            Disconnect
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <div className={className} style={style}>
      {error && (
        <div style={{ color: 'red', marginBottom: '12px', fontSize: '14px' }}>
          Error: {error.message}
        </div>
      )}
      
      <div style={{ display: 'grid', gap: '8px' }}>
        <h3 style={{ margin: '0 0 12px 0' }}>Connect Wallet</h3>
        {supportedWallets.map(wallet => (
          <button
            key={wallet.id}
            onClick={() => handleConnect(wallet.id)}
            disabled={isConnecting || (!wallet.installed && wallet.id !== 'walletconnect')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              background: wallet.installed || wallet.id === 'walletconnect' ? 'white' : '#f5f5f5',
              cursor: wallet.installed || wallet.id === 'walletconnect' ? 'pointer' : 'not-allowed',
              opacity: wallet.installed || wallet.id === 'walletconnect' ? 1 : 0.6
            }}
          >
            <img 
              src={wallet.icon} 
              alt={wallet.name}
              style={{ width: '24px', height: '24px' }}
            />
            <span style={{ flex: 1, textAlign: 'left' }}>{wallet.name}</span>
            {!wallet.installed && wallet.downloadUrl && (
              <a 
                href={wallet.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ 
                  fontSize: '12px', 
                  color: '#007acc',
                  textDecoration: 'none'
                }}
                onClick={e => e.stopPropagation()}
              >
                Install
              </a>
            )}
            {isConnecting && (
              <div style={{ 
                width: '16px', 
                height: '16px', 
                border: '2px solid #f3f3f3',
                borderTop: '2px solid #007acc',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            )}
          </button>
        ))}
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

// ============ Network Switcher Component ============

export interface NetworkSwitcherProps {
  className?: string
  style?: React.CSSProperties
  compact?: boolean
}

export const NetworkSwitcher: React.FC<NetworkSwitcherProps> = ({
  className,
  style,
  compact = false
}) => {
  const { wallet, switchNetwork, config, networkError } = useWalletContext()
  
  if (!wallet) return null
  
  const currentNetwork = wallet.network
  const supportedNetworks = config.supportedNetworks || []
  
  const networkNames: Record<number, string> = {
    1: 'Ethereum',
    8453: 'Base',
    545: 'Flow EVM Testnet'
  }
  
  const handleNetworkChange = async (chainId: number) => {
    try {
      await switchNetwork(chainId)
    } catch (error) {
      console.error('Network switch failed:', error)
    }
  }
  
  if (compact) {
    return (
      <div className={className} style={style}>
        <select
          value={currentNetwork}
          onChange={(e) => handleNetworkChange(Number(e.target.value))}
          style={{
            padding: '4px 8px',
            border: networkError ? '1px solid red' : '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '12px'
          }}
        >
          {supportedNetworks.map(chainId => (
            <option key={chainId} value={chainId}>
              {networkNames[chainId] || `Chain ${chainId}`}
            </option>
          ))}
        </select>
        {networkError && (
          <div style={{ color: 'red', fontSize: '10px', marginTop: '2px' }}>
            Unsupported network
          </div>
        )}
      </div>
    )
  }
  
  return (
    <div className={className} style={style}>
      <h4>Switch Network</h4>
      <div style={{ display: 'grid', gap: '8px' }}>
        {supportedNetworks.map(chainId => (
          <button
            key={chainId}
            onClick={() => handleNetworkChange(chainId)}
            disabled={chainId === currentNetwork}
            style={{
              padding: '8px 12px',
              border: chainId === currentNetwork ? '2px solid #007acc' : '1px solid #ddd',
              borderRadius: '4px',
              background: chainId === currentNetwork ? '#f0f8ff' : 'white',
              cursor: chainId === currentNetwork ? 'default' : 'pointer'
            }}
          >
            {networkNames[chainId] || `Chain ${chainId}`}
            {chainId === currentNetwork && ' (Current)'}
          </button>
        ))}
      </div>
    </div>
  )
}

// ============ Transaction Status Component ============

export interface TransactionStatusProps {
  className?: string
  style?: React.CSSProperties
  maxTransactions?: number
}

export const TransactionStatus: React.FC<TransactionStatusProps> = ({
  className,
  style,
  maxTransactions = 5
}) => {
  const { pendingTransactions } = useWalletContext()
  
  if (pendingTransactions.length === 0) return null
  
  const visibleTransactions = pendingTransactions.slice(-maxTransactions)
  
  return (
    <div className={className} style={style}>
      <h4>Pending Transactions</h4>
      <div style={{ display: 'grid', gap: '8px' }}>
        {visibleTransactions.map(tx => (
          <div
            key={tx.hash}
            style={{
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: '#f9f9f9'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
                {tx.type.toUpperCase()}
              </span>
              <span style={{ fontSize: '10px', color: '#666' }}>
                {new Date(tx.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
              {tx.description}
            </div>
            <div style={{ fontSize: '10px', fontFamily: 'monospace', marginTop: '4px' }}>
              {tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============ Higher-Order Component ============

export interface WithWalletProps {
  wallet: WalletContextValue
}

export const withWallet = <P extends WithWalletProps>(
  Component: React.ComponentType<P>
) => {
  return (props: Omit<P, 'wallet'>) => {
    const wallet = useWalletContext()
    return <Component {...(props as P)} wallet={wallet} />
  }
}