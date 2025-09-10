import React, { useState } from 'react'
import { formatDate, formatTimeAgo, formatCurrency, formatPercentage, formatPollStatus } from '../utils'
import type { Poll, BetRequest } from '../types'

export interface MarketCardProps {
  poll: Poll
  onBet?: (betRequest: BetRequest) => Promise<void>
  onViewDetails?: (pollId: string) => void
  className?: string
  style?: React.CSSProperties
  showBetButtons?: boolean
  isLoading?: boolean
}

export const MarketCard: React.FC<MarketCardProps> = ({
  poll,
  onBet,
  onViewDetails,
  className,
  style,
  showBetButtons = true,
  isLoading = false
}) => {
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [betAmount, setBetAmount] = useState<string>('')
  const [isPlacingBet, setIsPlacingBet] = useState(false)
  
  const pollStatus = formatPollStatus(poll)
  const totalVotes = poll.options.reduce((sum, option) => sum + option.votes, 0)
  
  const handleBet = async (optionId: number) => {
    if (!onBet || !betAmount || isNaN(Number(betAmount))) return
    
    setIsPlacingBet(true)
    try {
      await onBet({
        poll_id: poll.id,
        option_id: optionId,
        amount: Number(betAmount),
        slippage_tolerance: 0.02 // 2% default slippage
      })
      setBetAmount('')
      setSelectedOption(null)
    } catch (error) {
      console.error('Bet failed:', error)
    } finally {
      setIsPlacingBet(false)
    }
  }
  
  return (
    <div
      className={className}
      style={{
        border: '1px solid #e1e5e9',
        borderRadius: '12px',
        padding: '20px',
        background: 'white',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        opacity: isLoading ? 0.7 : 1,
        transition: 'all 0.2s ease',
        ...style
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <span
            style={{
              color: pollStatus.color,
              fontSize: '12px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            {pollStatus.text}
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {poll.oracle_backed && (
              <span
                style={{
                  background: '#e3f2fd',
                  color: '#1976d2',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '10px',
                  fontWeight: '600'
                }}
              >
                ORACLE
              </span>
            )}
            <span style={{ color: '#666', fontSize: '12px' }}>
              {formatTimeAgo(poll.created_at)}
            </span>
          </div>
        </div>
        
        <h3
          style={{
            margin: '0 0 8px 0',
            fontSize: '16px',
            fontWeight: '600',
            lineHeight: '1.4',
            color: '#1a1a1a'
          }}
        >
          {poll.question}
        </h3>
        
        {poll.description && (
          <p style={{ 
            margin: '0',
            fontSize: '14px',
            color: '#666',
            lineHeight: '1.4'
          }}>
            {poll.description}
          </p>
        )}
      </div>
      
      {/* Market Stats */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: '12px', 
        marginBottom: '16px',
        padding: '12px',
        background: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a1a' }}>
            {formatCurrency(poll.total_pool)}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>Total Pool</div>
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a1a' }}>
            {totalVotes.toLocaleString()}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>Total Bets</div>
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#1a1a1a' }}>
            {poll.expires_at ? formatDate(poll.expires_at, 'MMM dd') : '∞'}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {poll.expires_at ? 'Expires' : 'No Expiry'}
          </div>
        </div>
      </div>
      
      {/* Options */}
      <div style={{ marginBottom: showBetButtons ? '16px' : '0' }}>
        {poll.options.map((option) => {
          const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0
          const isSelected = selectedOption === option.id
          
          return (
            <div
              key={option.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                marginBottom: '8px',
                border: isSelected ? '2px solid #007acc' : '1px solid #e1e5e9',
                borderRadius: '8px',
                background: isSelected ? '#f0f8ff' : 'white',
                cursor: showBetButtons ? 'pointer' : 'default',
                transition: 'all 0.2s ease'
              }}
              onClick={() => showBetButtons && setSelectedOption(option.id)}
            >
              <div style={{ flex: 1 }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '4px'
                }}>
                  <span style={{ 
                    fontWeight: '500',
                    color: '#1a1a1a'
                  }}>
                    {option.text}
                  </span>
                  <span style={{ 
                    fontWeight: '600',
                    color: '#007acc'
                  }}>
                    {formatPercentage(percentage / 100)}
                  </span>
                </div>
                
                {/* Progress bar */}
                <div style={{
                  width: '100%',
                  height: '4px',
                  background: '#e1e5e9',
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}>
                  <div
                    style={{
                      width: `${percentage}%`,
                      height: '100%',
                      background: '#007acc',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
                
                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '4px'
                }}>
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    {option.votes.toLocaleString()} bets
                  </span>
                  {option.payout_multiplier && (
                    <span style={{ fontSize: '12px', color: '#28a745', fontWeight: '600' }}>
                      {option.payout_multiplier.toFixed(2)}x
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      
      {/* Betting Interface */}
      {showBetButtons && pollStatus.status === 'active' && (
        <div style={{ borderTop: '1px solid #e1e5e9', paddingTop: '16px' }}>
          {selectedOption !== null ? (
            <div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  Bet Amount (USD)
                </label>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  placeholder="Enter amount..."
                  min="0.01"
                  step="0.01"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #e1e5e9',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleBet(selectedOption)}
                  disabled={!betAmount || isPlacingBet || isNaN(Number(betAmount))}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#007acc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    opacity: (!betAmount || isPlacingBet || isNaN(Number(betAmount))) ? 0.6 : 1,
                    transition: 'opacity 0.2s ease'
                  }}
                >
                  {isPlacingBet ? 'Placing Bet...' : `Place Bet`}
                </button>
                
                <button
                  onClick={() => {
                    setSelectedOption(null)
                    setBetAmount('')
                  }}
                  style={{
                    padding: '10px 16px',
                    background: 'white',
                    color: '#666',
                    border: '1px solid #e1e5e9',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <p style={{ 
                margin: '0 0 12px 0',
                color: '#666',
                fontSize: '14px'
              }}>
                Select an option to place a bet
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Footer */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginTop: '16px',
        paddingTop: '16px',
        borderTop: '1px solid #e1e5e9'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ 
            background: '#f0f0f0',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500',
            color: '#666'
          }}>
            {poll.category.toUpperCase()}
          </span>
          
          {poll.oracle_provider && (
            <span style={{ fontSize: '12px', color: '#666' }}>
              Oracle: {poll.oracle_provider.toUpperCase()}
            </span>
          )}
        </div>
        
        {onViewDetails && (
          <button
            onClick={() => onViewDetails(poll.id)}
            style={{
              padding: '6px 12px',
              background: 'transparent',
              color: '#007acc',
              border: '1px solid #007acc',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#007acc'
              e.currentTarget.style.color = 'white'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#007acc'
            }}
          >
            View Details
          </button>
        )}
      </div>
    </div>
  )
}