"""
Smart Contract JSON Schemas for OpenOracle SDK

Provides Pydantic models that exactly match the smart contract structures
for seamless interaction between AI-generated data and blockchain contracts.
"""

from typing import List, Optional, Dict, Any, Literal, Union
from datetime import datetime
from decimal import Decimal
from enum import Enum
from pydantic import BaseModel, Field, validator, root_validator

# ============ Base Contract Enums ============

class TokenType(str, Enum):
    """Supported payment tokens on Base Ethereum (matches contract)"""
    NATIVE_ETH = "NATIVE_ETH"    # address(0) - Native ETH 
    USDC = "USDC"                # Circle USD Coin
    PYUSD = "PYUSD"              # PayPal USD
    CBETH = "CBETH"              # Coinbase Wrapped Staked ETH
    WETH = "WETH"                # Wrapped ETH on Base

class PollStatus(str, Enum):
    """Poll lifecycle states (matches contract logic)"""
    ACTIVE = "active"            # Poll is accepting bets
    ENDED = "ended"              # Poll ended, awaiting resolution
    RESOLVED = "resolved"        # Poll resolved with winning option
    CANCELLED = "cancelled"      # Poll was cancelled
    REFUNDED = "refunded"        # Single participant refund case

class BettingTier(str, Enum):
    """Time-based betting tiers with multipliers (matches contract)"""
    EARLY_BIRD = "early_bird"    # 1.5x bonus (first 10% of duration)
    QUICK = "quick"              # 1.3x bonus (10-30% of duration)
    NORMAL = "normal"            # 1.1x bonus (30-60% of duration)
    BASE = "base"                # 1.0x (60-100% of duration)

# ============ Contract Structure Models ============

class TokenConfig(BaseModel):
    """Token configuration matching contract TokenConfig struct"""
    is_accepted: bool = Field(..., description="Whether token is accepted")
    min_bet: int = Field(..., description="Minimum bet in token units")
    max_bet: int = Field(..., description="Maximum bet in token units")  
    decimals: int = Field(..., description="Token decimals (18 for ETH/WETH, 6 for USDC/PYUSD)")
    symbol: str = Field(..., description="Token symbol for display")
    total_volume: int = Field(0, description="Total volume for this token")
    
    # Contract addresses on Base
    contract_address: Optional[str] = Field(None, description="Token contract address")
    
    class Config:
        json_schema_extra = {
            "example": {
                "is_accepted": True,
                "min_bet": 1000000,  # $1 USDC (6 decimals)
                "max_bet": 10000000000,  # $10,000 USDC 
                "decimals": 6,
                "symbol": "USDC",
                "total_volume": 0,
                "contract_address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
            }
        }

class UserBet(BaseModel):
    """User bet details matching contract UserBet struct"""
    option: int = Field(..., ge=0, le=4, description="Option index (0-4)")
    amount: int = Field(..., gt=0, description="Bet amount in token units")
    weighted_amount: int = Field(..., description="Amount after time multiplier")
    timestamp: int = Field(..., description="Unix timestamp of bet")
    has_voted: bool = Field(True, description="Whether user has voted (always true for bets)")
    
    # Additional fields for SDK use
    tier: Optional[BettingTier] = Field(None, description="Which time tier this bet falls into")
    multiplier: Optional[float] = Field(None, description="Time multiplier applied (1.0-1.5)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "option": 0,
                "amount": 5000000,  # $5 USDC
                "weighted_amount": 7500000,  # $7.50 with 1.5x early bird bonus
                "timestamp": 1703097600,
                "has_voted": True,
                "tier": "early_bird",
                "multiplier": 1.5
            }
        }

class PollOption(BaseModel):
    """Individual poll option with betting pools"""
    index: int = Field(..., ge=0, le=4, description="Option index")
    text: str = Field(..., min_length=1, max_length=100, description="Option text")
    pool: int = Field(0, description="Total pool for this option")
    weighted_pool: int = Field(0, description="Weighted pool (with time multipliers)")
    percentage: Optional[float] = Field(None, ge=0, le=100, description="Pool percentage")
    
    class Config:
        json_schema_extra = {
            "example": {
                "index": 0,
                "text": "Price will rise 10%+",
                "pool": 25000000,  # $25 USDC
                "weighted_pool": 35000000,  # $35 USDC weighted
                "percentage": 35.0
            }
        }

class Poll(BaseModel):
    """Complete poll structure matching contract Poll struct"""
    
    # Core poll data
    poll_id: int = Field(..., ge=0, description="Unique poll identifier")
    article_url: str = Field(..., description="Source article URL")
    question: str = Field(..., min_length=10, max_length=500, description="Poll question")
    options: List[PollOption] = Field(..., min_items=2, max_items=5, description="Poll options")
    
    # Token and timing
    payment_token: TokenType = Field(..., description="Accepted payment token")
    token_symbol: str = Field(..., description="Token display symbol")
    start_time: int = Field(..., description="Poll start timestamp")
    end_time: int = Field(..., description="Poll end timestamp") 
    duration: int = Field(..., ge=86400, le=345600, description="Duration in seconds (24-96 hours)")
    
    # Financial data
    total_pool: int = Field(0, description="Total betting pool")
    platform_fee: int = Field(0, description="Platform fee amount (2.5%)")
    creator_reward: int = Field(0, description="Creator reward amount")
    
    # Time-based cutoffs for multipliers
    early_bird_cutoff: int = Field(..., description="Early bird tier cutoff timestamp")
    quick_cutoff: int = Field(..., description="Quick tier cutoff timestamp")
    normal_cutoff: int = Field(..., description="Normal tier cutoff timestamp")
    
    # Resolution data
    resolved: bool = Field(False, description="Whether poll is resolved")
    winning_option: Optional[int] = Field(None, ge=0, le=4, description="Winning option index")
    was_cancelled: bool = Field(False, description="Whether poll was cancelled")
    was_refunded: bool = Field(False, description="Whether single participant refund occurred")
    
    # Creator and participant data
    creator: str = Field(..., description="Creator wallet address")
    participants: List[str] = Field(default_factory=list, description="List of participant addresses")
    participant_count: int = Field(0, description="Number of unique participants")
    
    @validator('options')
    def validate_options(cls, v):
        if not (2 <= len(v) <= 5):
            raise ValueError('Poll must have 2-5 options')
        return v
    
    @validator('end_time', pre=False, always=True)
    def validate_timing(cls, v, values):
        start_time = values.get('start_time', 0)
        if v <= start_time:
            raise ValueError('End time must be after start time')
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "poll_id": 123,
                "article_url": "https://coindesk.com/bitcoin-price-analysis",
                "question": "Will Bitcoin exceed $100,000 by end of 2024?",
                "options": [
                    {
                        "index": 0,
                        "text": "Yes, BTC > $100k",
                        "pool": 50000000,
                        "weighted_pool": 65000000,
                        "percentage": 65.0
                    },
                    {
                        "index": 1, 
                        "text": "No, BTC < $100k",
                        "pool": 35000000,
                        "weighted_pool": 35000000,
                        "percentage": 35.0
                    }
                ],
                "payment_token": "USDC",
                "token_symbol": "USDC",
                "start_time": 1703097600,
                "end_time": 1703184000,
                "duration": 86400,
                "total_pool": 85000000,
                "platform_fee": 2125000,
                "creator_reward": 0,
                "early_bird_cutoff": 1703106240,
                "quick_cutoff": 1703123520,
                "normal_cutoff": 1703149440,
                "resolved": False,
                "winning_option": None,
                "was_cancelled": False,
                "was_refunded": False,
                "creator": "0x742d35Cc6634C0532925a3b8D0Ac5f06eDd5C0L2",
                "participants": [],
                "participant_count": 0
            }
        }

# ============ Transaction Models ============

class PollCreationRequest(BaseModel):
    """Request to create a new poll (matches contract createPoll function)"""
    article_url: str = Field(..., description="Source article URL")
    question: str = Field(..., min_length=10, max_length=500, description="Poll question")
    options: List[str] = Field(..., min_items=2, max_items=5, description="Option texts")
    payment_token: TokenType = Field(..., description="Accepted payment token") 
    duration: int = Field(86400, ge=86400, le=345600, description="Duration in seconds")
    
    # Optional creator settings
    creator_reward_enabled: bool = Field(False, description="Whether to enable creator rewards")
    
    @validator('options')
    def validate_options_length(cls, v):
        for option in v:
            if not (1 <= len(option.strip()) <= 100):
                raise ValueError('Each option must be 1-100 characters')
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "article_url": "https://techcrunch.com/ai-breakthrough",
                "question": "Will this AI company IPO within 12 months?",
                "options": ["Yes, within 12 months", "No, will take longer"],
                "payment_token": "USDC",
                "duration": 172800,  # 48 hours
                "creator_reward_enabled": False
            }
        }

class BetRequest(BaseModel):
    """Request to place a bet (matches contract placeBet function)"""
    poll_id: int = Field(..., ge=0, description="Poll ID to bet on")
    option: int = Field(..., ge=0, le=4, description="Option to bet on (0-4)")
    amount: int = Field(..., gt=0, description="Bet amount in token units")
    
    # For SDK convenience - these will be calculated
    expected_tier: Optional[BettingTier] = Field(None, description="Expected time tier")
    expected_multiplier: Optional[float] = Field(None, description="Expected multiplier")
    max_slippage: Optional[float] = Field(0.01, description="Max acceptable tier slippage")
    
    class Config:
        json_schema_extra = {
            "example": {
                "poll_id": 123,
                "option": 0,
                "amount": 10000000,  # $10 USDC
                "expected_tier": "early_bird",
                "expected_multiplier": 1.5,
                "max_slippage": 0.01
            }
        }

class ClaimRequest(BaseModel):
    """Request to claim winnings (matches contract claimWinnings function)"""
    poll_id: int = Field(..., ge=0, description="Poll ID to claim from")
    
    class Config:
        json_schema_extra = {
            "example": {
                "poll_id": 123
            }
        }

# ============ Response Models ============

class TransactionResponse(BaseModel):
    """Response from contract transaction"""
    success: bool = Field(..., description="Whether transaction succeeded")
    transaction_hash: Optional[str] = Field(None, description="Transaction hash")
    gas_used: Optional[int] = Field(None, description="Gas used")
    gas_price: Optional[int] = Field(None, description="Gas price in wei")
    block_number: Optional[int] = Field(None, description="Block number")
    
    # Additional response data
    poll_id: Optional[int] = Field(None, description="Poll ID (for creation)")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "transaction_hash": "0xabc123...",
                "gas_used": 150000,
                "gas_price": 2000000000,  # 2 gwei
                "block_number": 12345678,
                "poll_id": 123,
                "error_message": None
            }
        }

class PollState(BaseModel):
    """Current poll state for display"""
    poll: Poll = Field(..., description="Poll data")
    current_tier: BettingTier = Field(..., description="Current time tier")
    current_multiplier: float = Field(..., description="Current time multiplier")
    time_remaining: int = Field(..., description="Seconds until poll ends")
    can_bet: bool = Field(..., description="Whether betting is still allowed")
    total_bettors: int = Field(..., description="Number of unique bettors")
    
    class Config:
        json_schema_extra = {
            "example": {
                "poll": {"poll_id": 123},  # Full poll object
                "current_tier": "quick",
                "current_multiplier": 1.3,
                "time_remaining": 43200,  # 12 hours
                "can_bet": True,
                "total_bettors": 25
            }
        }

# ============ Oracle Integration Models ============

class OracleResolutionRequest(BaseModel):
    """Request for oracle to resolve a poll"""
    poll_id: int = Field(..., ge=0, description="Poll to resolve")
    resolution_data: Dict[str, Any] = Field(..., description="Data needed for resolution")
    oracle_provider: str = Field(..., description="Oracle provider to use")
    confidence_threshold: float = Field(0.8, ge=0.5, le=1.0, description="Minimum confidence")
    
    class Config:
        json_schema_extra = {
            "example": {
                "poll_id": 123,
                "resolution_data": {
                    "bitcoin_price": 105000,
                    "data_source": "coinbase",
                    "timestamp": 1703097600
                },
                "oracle_provider": "chainlink",
                "confidence_threshold": 0.9
            }
        }

class OracleResolutionResponse(BaseModel):
    """Oracle resolution response"""
    poll_id: int = Field(..., description="Resolved poll ID")
    winning_option: int = Field(..., ge=0, le=4, description="Winning option index")
    confidence: float = Field(..., ge=0, le=1, description="Oracle confidence")
    data_sources: List[str] = Field(..., description="Data sources used")
    resolution_timestamp: int = Field(..., description="Resolution timestamp")
    
    class Config:
        json_schema_extra = {
            "example": {
                "poll_id": 123,
                "winning_option": 0,
                "confidence": 0.95,
                "data_sources": ["coinbase", "binance", "kraken"],
                "resolution_timestamp": 1703097600
            }
        }

# ============ Utility Functions ============

def get_token_config_by_type(token_type: TokenType) -> Dict[str, Any]:
    """Get default token configuration by type"""
    configs = {
        TokenType.NATIVE_ETH: {
            "contract_address": "0x0000000000000000000000000000000000000000",
            "decimals": 18,
            "symbol": "ETH",
            "min_bet": 1000000000000000,  # 0.001 ETH
            "max_bet": 10000000000000000000  # 10 ETH
        },
        TokenType.USDC: {
            "contract_address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "decimals": 6,
            "symbol": "USDC", 
            "min_bet": 1000000,  # $1 USDC
            "max_bet": 10000000000  # $10,000 USDC
        },
        TokenType.PYUSD: {
            "contract_address": "0xcAa940d48B22b8F3fb53b7d5Eb0a0E43bC261d3C",
            "decimals": 6,
            "symbol": "PYUSD",
            "min_bet": 1000000,  # $1 PYUSD
            "max_bet": 10000000000  # $10,000 PYUSD
        },
        TokenType.CBETH: {
            "contract_address": "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
            "decimals": 18, 
            "symbol": "cbETH",
            "min_bet": 1000000000000000,  # 0.001 cbETH
            "max_bet": 10000000000000000000  # 10 cbETH
        },
        TokenType.WETH: {
            "contract_address": "0x4200000000000000000000000000000000000006",
            "decimals": 18,
            "symbol": "WETH",
            "min_bet": 1000000000000000,  # 0.001 WETH
            "max_bet": 10000000000000000000  # 10 WETH
        }
    }
    return configs.get(token_type, {})

def calculate_time_tier(start_time: int, end_time: int, current_time: int) -> tuple[BettingTier, float]:
    """Calculate current time tier and multiplier"""
    duration = end_time - start_time
    elapsed = current_time - start_time
    progress = elapsed / duration
    
    if progress <= 0.1:
        return BettingTier.EARLY_BIRD, 1.5
    elif progress <= 0.3:
        return BettingTier.QUICK, 1.3
    elif progress <= 0.6:
        return BettingTier.NORMAL, 1.1
    else:
        return BettingTier.BASE, 1.0

def validate_poll_creation_data(data: Dict[str, Any]) -> PollCreationRequest:
    """Validate and parse poll creation data"""
    return PollCreationRequest.model_validate(data)

def format_amount_for_display(amount: int, token_type: TokenType) -> str:
    """Format token amount for display"""
    config = get_token_config_by_type(token_type)
    decimals = config.get('decimals', 18)
    symbol = config.get('symbol', 'TOKEN')
    
    # Convert to decimal and format
    display_amount = amount / (10 ** decimals)
    
    if decimals == 6:  # USDC, PYUSD
        return f"${display_amount:,.2f}"
    else:  # ETH, WETH, cbETH
        return f"{display_amount:.4f} {symbol}"