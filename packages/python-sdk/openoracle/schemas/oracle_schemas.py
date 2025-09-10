"""
Oracle Provider Schemas for OpenOracle
Comprehensive Pydantic models for all supported oracle providers
"""

from typing import List, Optional, Dict, Any, Literal, Union
from datetime import datetime
from decimal import Decimal
from enum import Enum
from pydantic import BaseModel, Field, validator, root_validator

# ============ Common Enums and Base Models ============

class OracleProvider(str, Enum):
    """Supported oracle providers"""
    CHAINLINK = "chainlink"
    PYTH = "pyth"
    BAND = "band"
    UMA = "uma"
    API3 = "api3"
    DIA = "dia"
    TELLOR = "tellor"
    SUPRA = "supra"

class DataCategory(str, Enum):
    """Categories of data that oracles can provide"""
    PRICE = "price"              # Crypto, stock, commodity prices
    SPORTS = "sports"            # Sports scores and outcomes
    WEATHER = "weather"          # Weather data
    ELECTION = "election"        # Election results
    ECONOMIC = "economic"        # Economic indicators (GDP, CPI, etc.)
    RANDOM = "random"            # VRF random numbers
    CUSTOM = "custom"            # Custom data requests
    EVENTS = "events"            # Real-world events
    STOCKS = "stocks"            # Stock market data
    FOREX = "forex"              # Foreign exchange rates
    COMMODITIES = "commodities"  # Commodity prices
    NFT = "nft"                  # NFT floor prices and metadata

class UpdateFrequency(str, Enum):
    """Data update frequency requirements"""
    REALTIME = "realtime"        # < 1 second
    HIGH_FREQ = "high_freq"      # 1-10 seconds
    MEDIUM_FREQ = "medium_freq"  # 10 seconds - 1 minute
    LOW_FREQ = "low_freq"        # 1-10 minutes
    HOURLY = "hourly"            # Once per hour
    DAILY = "daily"              # Once per day
    ON_DEMAND = "on_demand"      # Pull-based updates

# ============ Chainlink Schemas ============

class ChainlinkPriceFeed(BaseModel):
    """Chainlink price feed data structure"""
    feed_id: str = Field(..., description="Price feed identifier")
    pair: str = Field(..., description="Asset pair (e.g., ETH/USD)")
    decimals: int = Field(..., ge=0, le=18)
    latest_answer: Decimal = Field(..., description="Latest price")
    updated_at: datetime
    round_id: int = Field(..., ge=0)
    answered_in_round: int = Field(..., ge=0)
    
    # Aggregator metadata
    min_answer: Optional[Decimal] = None
    max_answer: Optional[Decimal] = None
    heartbeat: Optional[int] = Field(None, description="Expected update interval in seconds")
    
    # Data quality metrics
    num_oracles: Optional[int] = Field(None, ge=1)
    aggregator_address: Optional[str] = None
    proxy_address: Optional[str] = None

class ChainlinkVRFRequest(BaseModel):
    """Chainlink VRF (Verifiable Random Function) request"""
    request_id: str
    subscription_id: int
    num_words: int = Field(..., ge=1, le=500)
    callback_gas_limit: int = Field(..., ge=100000)
    confirmation_blocks: int = Field(default=3, ge=1)
    
class ChainlinkFunctionsRequest(BaseModel):
    """Chainlink Functions request for custom API calls"""
    source_code: str = Field(..., description="JavaScript source code")
    secrets: Optional[Dict[str, str]] = Field(None, description="Encrypted secrets")
    args: List[str] = Field(default_factory=list)
    subscription_id: int
    callback_gas_limit: int = Field(default=300000)

class ChainlinkAPIResponse(BaseModel):
    """Chainlink Any API response structure"""
    job_id: str
    request_id: str
    result: Union[str, int, float, Dict[str, Any]]
    fulfilled: bool
    error: Optional[str] = None
    
# ============ Pyth Network Schemas ============

class PythPriceFeed(BaseModel):
    """Pyth Network price feed structure"""
    feed_id: str = Field(..., description="Pyth price feed ID (hex)")
    symbol: str = Field(..., description="Asset symbol")
    price: Decimal = Field(..., description="Current price")
    confidence: Decimal = Field(..., description="Confidence interval")
    expo: int = Field(..., description="Price exponent")
    publish_time: datetime
    
    # EMA (Exponential Moving Average) data
    ema_price: Optional[Decimal] = None
    ema_confidence: Optional[Decimal] = None
    
    # Publisher data
    num_publishers: int = Field(..., ge=1)
    max_num_publishers: int
    
    # Price components
    price_components: Optional[List[Dict[str, Any]]] = None
    
    @validator('price', 'confidence')
    def adjust_for_exponent(cls, v, values):
        """Adjust price and confidence based on exponent"""
        if 'expo' in values:
            return v * Decimal(10) ** values['expo']
        return v

class PythUpdateData(BaseModel):
    """Pyth pull-based update data"""
    update_data: List[str] = Field(..., description="Hex-encoded update data")
    update_fee: int = Field(..., description="Fee in wei for update")
    valid_time: datetime
    
# ============ Band Protocol Schemas ============

class BandReferenceData(BaseModel):
    """Band Protocol reference data structure"""
    symbol: str
    rate: Decimal
    resolve_time: datetime
    request_id: Optional[int] = None
    
    # Data source information
    sources: List[str] = Field(..., description="Data sources used")
    aggregation_method: Literal["median", "mean", "mode"] = "median"
    
class BandStandardDataset(BaseModel):
    """Band Protocol standard dataset query"""
    symbols: List[str] = Field(..., min_items=1)
    minimum_sources: int = Field(default=3, ge=1)
    ask_count: int = Field(default=1, ge=1)
    min_count: int = Field(default=1, ge=1)

class BandCustomRequest(BaseModel):
    """Band Protocol custom oracle request"""
    oracle_script_id: int
    calldata: str = Field(..., description="Hex-encoded calldata")
    ask_count: int = Field(default=4, ge=1)
    min_count: int = Field(default=3, ge=1)
    client_id: str
    fee_limit: Optional[int] = None

# ============ UMA Protocol Schemas ============

class UMAOptimisticOracleRequest(BaseModel):
    """UMA Optimistic Oracle request structure"""
    identifier: str = Field(..., description="Price identifier")
    timestamp: datetime
    ancillary_data: Optional[str] = Field(None, description="Additional data for request")
    currency: str = Field(default="USDC", description="Bond currency")
    reward: Decimal = Field(..., gt=0, description="Reward for proposer")
    bond: Decimal = Field(..., gt=0, description="Proposal bond")
    custom_liveness: Optional[int] = Field(None, description="Custom liveness period in seconds")
    
class UMAProposal(BaseModel):
    """UMA Oracle proposal"""
    request_id: str
    proposer: str = Field(..., description="Proposer address")
    proposed_price: Decimal
    expiration_time: datetime
    disputed: bool = Field(default=False)
    
class UMADispute(BaseModel):
    """UMA Oracle dispute"""
    request_id: str
    disputer: str = Field(..., description="Disputer address")
    dispute_time: datetime
    dispute_bond: Decimal
    
# ============ API3 Schemas ============

class API3dAPI(BaseModel):
    """API3 decentralized API (dAPI) structure"""
    dapi_name: str = Field(..., description="dAPI identifier")
    beacon_id: str = Field(..., description="Beacon ID (hex)")
    value: Union[int, float, str]
    timestamp: datetime
    
    # Data provider information
    provider_name: Optional[str] = None
    provider_address: Optional[str] = None
    
class API3OIS(BaseModel):
    """API3 Oracle Integration Specification"""
    ois_format: str = Field(default="2.1.0")
    title: str
    version: str
    api_specifications: Dict[str, Any]
    endpoints: List[Dict[str, Any]]
    
class API3AirnodeRequest(BaseModel):
    """API3 Airnode request structure"""
    airnode_address: str
    endpoint_id: str
    sponsor_address: str
    sponsor_wallet_address: str
    parameters: Dict[str, Any]
    
# ============ Oracle Routing Request/Response ============

class OracleCapability(BaseModel):
    """Describes what an oracle can provide"""
    provider: OracleProvider
    data_categories: List[DataCategory]
    supported_chains: List[str]
    update_frequency: UpdateFrequency
    latency_ms: int = Field(..., description="Average latency in milliseconds")
    cost_estimate_usd: Optional[Decimal] = None
    reliability_score: float = Field(..., ge=0, le=1)
    
class OracleRoutingRequest(BaseModel):
    """Request to route a poll question to appropriate oracle"""
    question: str = Field(..., description="Poll question to analyze")
    category_hint: Optional[DataCategory] = None
    required_chains: Optional[List[str]] = None
    max_latency_ms: Optional[int] = Field(None, gt=0)
    max_cost_usd: Optional[Decimal] = Field(None, gt=0)
    preferred_providers: Optional[List[OracleProvider]] = None

class AIEnhancementRequest(BaseModel):
    """Request for AI enhancement of oracle routing"""
    question: str
    current_oracle: Optional[OracleProvider] = None
    current_confidence: float = Field(..., ge=0, le=1)
    
class AIEnhancementResponse(BaseModel):
    """Response from AI enhancement"""
    oracle: OracleProvider
    data_type: DataCategory
    feeds: List[str] = Field(default_factory=list)
    reasoning: str
    confidence_boost: float = Field(default=0.2, ge=0, le=0.5)
    
class OracleRoutingResponse(BaseModel):
    """Response from oracle routing engine"""
    can_resolve: bool = Field(..., description="Whether any oracle can resolve this")
    selected_oracle: Optional[OracleProvider] = None
    reasoning: str = Field(..., description="Explanation of routing decision")
    
    # Oracle-specific configuration
    oracle_config: Optional[Dict[str, Any]] = None
    
    # Alternative options
    alternatives: Optional[List[OracleProvider]] = None
    
    # Data requirements
    data_type: Optional[DataCategory] = None
    required_feeds: Optional[List[str]] = None
    
    # Cost and performance estimates
    estimated_cost_usd: Optional[Decimal] = None
    estimated_latency_ms: Optional[int] = None
    confidence_score: float = Field(..., ge=0, le=1)
    
    # Resolution parameters
    resolution_method: Optional[Literal["direct", "aggregated", "optimistic"]] = None
    update_frequency: Optional[UpdateFrequency] = None
    
    @validator('selected_oracle')
    def validate_selection(cls, v, values):
        """Ensure oracle is selected only if resolvable"""
        if values.get('can_resolve') and not v:
            raise ValueError("Oracle must be selected if question is resolvable")
        return v

# ============ Oracle Data Response Models ============

class OracleDataPoint(BaseModel):
    """Generic oracle data point"""
    provider: OracleProvider
    data_type: DataCategory
    value: Union[str, int, float, bool, Dict[str, Any]]
    timestamp: datetime
    confidence: Optional[float] = Field(None, ge=0, le=1)
    metadata: Optional[Dict[str, Any]] = None
    
class OraclePollData(BaseModel):
    """Oracle data for creating/resolving a poll"""
    poll_id: str
    oracle_provider: OracleProvider
    data_points: List[OracleDataPoint]
    resolution_criteria: str = Field(..., description="How to resolve based on oracle data")
    resolution_time: Optional[datetime] = None
    auto_resolve: bool = Field(default=True)
    
    # Verification data
    proof: Optional[str] = Field(None, description="Cryptographic proof if available")
    attestation: Optional[str] = Field(None, description="Oracle attestation")
    
class OracleHealthCheck(BaseModel):
    """Oracle provider health status"""
    provider: OracleProvider
    is_healthy: bool
    last_update: datetime
    active_feeds: int
    error_rate: float = Field(..., ge=0, le=1)
    average_latency_ms: int
    status_message: str

# ============ Aggregated Oracle Data ============

class AggregatedOracleData(BaseModel):
    """Aggregated data from multiple oracles"""
    data_type: DataCategory
    providers: List[OracleProvider]
    aggregation_method: Literal["median", "mean", "weighted", "unanimous"]
    aggregated_value: Union[str, int, float, bool]
    individual_values: Dict[str, Any] = Field(..., description="Provider -> value mapping")
    timestamp: datetime
    confidence: float = Field(..., ge=0, le=1)
    discrepancy_detected: bool = Field(default=False)
    
    @root_validator
    def check_discrepancy(cls, values):
        """Check for significant discrepancies between oracle values"""
        # Implementation would check variance between individual values
        return values