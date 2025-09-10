"""
JSON Schema Validation for Oracle Contracts

This module ensures that JSON responses from LLM providers match exactly
with the smart contract structures defined in:
/Users/samsavage/flow-nft/contracts/contracts/interfaces/IOracle.sol

All Pydantic models here MUST match the Solidity structs exactly.
"""

from typing import List, Optional, Dict, Any, Literal, Union
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, validator
import json

# ============ Contract Enums (matching IOracle.sol) ============

class OracleProvider(str, Enum):
    """Oracle provider enum matching IOracleRouter.OracleProvider"""
    CHAINLINK = "CHAINLINK"  # 0
    PYTH = "PYTH"           # 1  
    UMA = "UMA"             # 2
    API3 = "API3"           # 3
    CUSTOM = "CUSTOM"       # 4

class MarketStatus(str, Enum):
    """Market status enum matching IPredictionMarket.MarketStatus"""
    ACTIVE = "ACTIVE"       # 0
    RESOLVED = "RESOLVED"   # 1
    CANCELLED = "CANCELLED" # 2
    DISPUTED = "DISPUTED"   # 3

# ============ Core Contract Structures ============

class OracleData(BaseModel):
    """Matches IOracle.OracleData struct exactly"""
    value: int = Field(..., description="uint256 value")
    timestamp: int = Field(..., description="uint256 timestamp") 
    confidence: int = Field(..., ge=0, le=10000, description="uint256 confidence (scaled by 1e4)")
    data_id: str = Field(..., description="bytes32 dataId (hex string)")
    source: str = Field(..., description="string source")
    
    @validator('data_id')
    def validate_data_id(cls, v):
        # Must be valid hex string for bytes32
        if not v.startswith('0x') or len(v) != 66:
            raise ValueError('data_id must be a valid bytes32 hex string')
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "value": 4250000000000000000000,  # $4250.00 with 18 decimals
                "timestamp": 1703097600,
                "confidence": 9500,  # 95.00%
                "data_id": "0x4254432d5553440000000000000000000000000000000000000000000000000", # BTC-USD
                "source": "chainlink_aggregator"
            }
        }

class PriceData(BaseModel):
    """Matches IOracle.PriceData struct exactly"""
    price: int = Field(..., description="uint256 price")
    timestamp: int = Field(..., description="uint256 timestamp")
    decimals: int = Field(..., ge=0, le=18, description="uint8 decimals")
    confidence: int = Field(..., ge=0, le=10000, description="uint256 confidence")
    feed_id: str = Field(..., description="bytes32 feedId")
    
    @validator('feed_id')
    def validate_feed_id(cls, v):
        if not v.startswith('0x') or len(v) != 66:
            raise ValueError('feed_id must be a valid bytes32 hex string')
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "price": 4250000000,  # $4250.00 with 6 decimals (USDC format)
                "timestamp": 1703097600,
                "decimals": 6,
                "confidence": 9800,
                "feed_id": "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"
            }
        }

class ResolutionData(BaseModel):
    """Matches IOracle.ResolutionData struct exactly"""
    result: int = Field(..., description="uint256 result")
    resolved: bool = Field(..., description="bool resolved")
    timestamp: int = Field(..., description="uint256 timestamp")
    proof: str = Field(..., description="bytes proof (hex string)")
    metadata: str = Field(..., description="string metadata")
    
    @validator('proof')
    def validate_proof(cls, v):
        # Must be valid hex string for bytes
        if v and not v.startswith('0x'):
            raise ValueError('proof must be a valid hex string')
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "result": 1,  # Option 1 wins
                "resolved": True,
                "timestamp": 1703097600,
                "proof": "0x1234567890abcdef",
                "metadata": "BTC price was $105,000 at resolution time"
            }
        }

# ============ Router Structures ============

class RouteConfig(BaseModel):
    """Matches IOracleRouter.RouteConfig struct exactly"""
    provider: OracleProvider = Field(..., description="OracleProvider provider")
    oracle_address: str = Field(..., description="address oracleAddress")
    priority: int = Field(..., description="uint256 priority")
    max_cost: int = Field(..., description="uint256 maxCost")
    is_active: bool = Field(..., description="bool isActive")
    
    @validator('oracle_address')
    def validate_address(cls, v):
        if not v.startswith('0x') or len(v) != 42:
            raise ValueError('oracle_address must be a valid Ethereum address')
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "provider": "CHAINLINK",
                "oracle_address": "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
                "priority": 100,
                "max_cost": 1000000000000000000,  # 1 ETH in wei
                "is_active": True
            }
        }

class RouteResult(BaseModel):
    """Matches IOracleRouter.RouteResult struct exactly"""
    success: bool = Field(..., description="bool success")
    selected_provider: OracleProvider = Field(..., description="OracleProvider selectedProvider")
    oracle_address: str = Field(..., description="address oracleAddress")
    estimated_cost: int = Field(..., description="uint256 estimatedCost")
    reason: str = Field(..., description="string reason")
    
    @validator('oracle_address')
    def validate_address(cls, v):
        if v != "0x0000000000000000000000000000000000000000" and (not v.startswith('0x') or len(v) != 42):
            raise ValueError('oracle_address must be a valid Ethereum address or zero address')
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "selected_provider": "CHAINLINK",
                "oracle_address": "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
                "estimated_cost": 500000000000000000,  # 0.5 ETH
                "reason": "Best price-reliability ratio"
            }
        }

# ============ Prediction Market Structures ============

class Market(BaseModel):
    """Matches IPredictionMarket.Market struct exactly"""
    market_id: int = Field(..., description="uint256 marketId")
    question: str = Field(..., description="string question")
    creator: str = Field(..., description="address creator")
    end_time: int = Field(..., description="uint256 endTime")
    status: MarketStatus = Field(..., description="MarketStatus status")
    total_pool: int = Field(..., description="uint256 totalPool")
    payment_token: str = Field(..., description="address paymentToken")
    oracle_data_type: str = Field(..., description="bytes32 oracleDataType")
    assigned_oracle: str = Field(..., description="address assignedOracle")
    oracle_params: str = Field(..., description="bytes oracleParams")
    
    @validator('creator', 'payment_token', 'assigned_oracle')
    def validate_addresses(cls, v):
        if not v.startswith('0x') or len(v) != 42:
            raise ValueError('Address must be valid Ethereum address')
        return v
    
    @validator('oracle_data_type')
    def validate_data_type(cls, v):
        if not v.startswith('0x') or len(v) != 66:
            raise ValueError('oracle_data_type must be valid bytes32')
        return v
    
    @validator('oracle_params')
    def validate_params(cls, v):
        if v and not v.startswith('0x'):
            raise ValueError('oracle_params must be valid hex bytes')
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "market_id": 123,
                "question": "Will BTC exceed $100k by Dec 31, 2024?",
                "creator": "0x742d35Cc6634C0532925a3b8D0Ac5f06eDd5C0e2",
                "end_time": 1735689600,  # Dec 31, 2024
                "status": "ACTIVE",
                "total_pool": 50000000000000000000,  # 50 ETH
                "payment_token": "0x0000000000000000000000000000000000000000",  # ETH
                "oracle_data_type": "0x5052494345000000000000000000000000000000000000000000000000000000",  # "PRICE"
                "assigned_oracle": "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419",
                "oracle_params": "0x4254432d555344"  # "BTC-USD" encoded
            }
        }

class Position(BaseModel):
    """Matches IPredictionMarket.Position struct exactly"""
    amount: int = Field(..., description="uint256 amount")
    outcome: int = Field(..., ge=0, le=255, description="uint8 outcome")
    timestamp: int = Field(..., description="uint256 timestamp")
    multiplier: int = Field(..., description="uint256 multiplier")
    
    class Config:
        json_schema_extra = {
            "example": {
                "amount": 5000000000000000000,  # 5 ETH
                "outcome": 1,  # Option 1
                "timestamp": 1703097600,
                "multiplier": 15000  # 1.5x multiplier (scaled by 1e4)
            }
        }

# ============ LLM Response Schemas ============

class OracleRoutingResponse(BaseModel):
    """JSON schema for LLM responses when selecting oracle providers"""
    selected_oracle: OracleProvider = Field(..., description="The selected oracle provider")
    reasoning: str = Field(..., min_length=50, description="Detailed reasoning for selection")
    confidence: float = Field(..., ge=0, le=1, description="Confidence in selection (0-1)")
    estimated_cost: Optional[float] = Field(None, description="Estimated cost in USD")
    estimated_time: Optional[int] = Field(None, description="Estimated response time in seconds")
    fallback_options: List[OracleProvider] = Field(default_factory=list, description="Alternative providers")
    
    class Config:
        json_schema_extra = {
            "example": {
                "selected_oracle": "CHAINLINK",
                "reasoning": "Chainlink is optimal for BTC price data due to its robust aggregation of multiple high-quality price feeds with proven reliability and sub-minute updates",
                "confidence": 0.92,
                "estimated_cost": 0.25,
                "estimated_time": 30,
                "fallback_options": ["PYTH", "API3"]
            }
        }

class PredictionMarketResolution(BaseModel):
    """JSON schema for LLM responses when resolving prediction markets"""
    winning_outcome: int = Field(..., ge=0, le=255, description="Winning outcome index")
    resolution_value: Optional[int] = Field(None, description="Actual value that determined outcome")
    confidence: float = Field(..., ge=0, le=1, description="Confidence in resolution")
    data_sources: List[str] = Field(..., min_items=1, description="Data sources used")
    reasoning: str = Field(..., min_length=100, description="Detailed reasoning for resolution")
    timestamp: int = Field(..., description="Resolution timestamp")
    proof_hash: Optional[str] = Field(None, description="Hash of proof data")
    
    class Config:
        json_schema_extra = {
            "example": {
                "winning_outcome": 0,
                "resolution_value": 105000,
                "confidence": 0.98,
                "data_sources": ["coinbase", "binance", "kraken_spot"],
                "reasoning": "Bitcoin price reached $105,000 on December 15, 2024, exceeding the $100k threshold. This was confirmed across multiple major exchanges with consistent pricing.",
                "timestamp": 1734220800,
                "proof_hash": "0xa7b4c9d3e2f1a8b5c6d7e8f9a1b2c3d4e5f6a7b8c9d0"
            }
        }

class OracleDataValidation(BaseModel):
    """JSON schema for validating oracle data quality"""
    is_valid: bool = Field(..., description="Whether data passes validation")
    confidence_score: float = Field(..., ge=0, le=1, description="Data quality confidence")
    anomaly_detected: bool = Field(False, description="Whether anomalies were found")
    data_freshness: int = Field(..., description="Age of data in seconds")
    source_reliability: float = Field(..., ge=0, le=1, description="Source reliability score")
    issues: List[str] = Field(default_factory=list, description="List of issues found")
    recommendations: List[str] = Field(default_factory=list, description="Recommendations for improvement")
    
    class Config:
        json_schema_extra = {
            "example": {
                "is_valid": True,
                "confidence_score": 0.94,
                "anomaly_detected": False,
                "data_freshness": 45,
                "source_reliability": 0.96,
                "issues": [],
                "recommendations": ["Consider adding more data sources for cross-validation"]
            }
        }

# ============ Utility Functions ============

def validate_contract_compatibility(python_schema: BaseModel, solidity_struct: str) -> bool:
    """
    Validate that a Python Pydantic model matches a Solidity struct
    
    Args:
        python_schema: Pydantic model instance
        solidity_struct: Name of the Solidity struct to compare against
        
    Returns:
        bool: True if schemas are compatible
    """
    # This would need actual ABI parsing in production
    # For now, it's a placeholder that validates basic structure
    
    schema_dict = python_schema.model_json_schema()
    required_fields = schema_dict.get('required', [])
    
    # Basic validation - ensure all required fields exist
    if len(required_fields) == 0:
        return False
        
    # Contract-specific validations
    if solidity_struct == "OracleData":
        expected_fields = {"value", "timestamp", "confidence", "data_id", "source"}
        return set(required_fields).issuperset(expected_fields)
    elif solidity_struct == "RouteResult":
        expected_fields = {"success", "selected_provider", "oracle_address", "estimated_cost", "reason"}
        return set(required_fields).issuperset(expected_fields)
    elif solidity_struct == "Market":
        expected_fields = {"market_id", "question", "creator", "end_time", "status"}
        return set(required_fields).issuperset(expected_fields)
    
    return True

def generate_json_schema_for_llm(schema_class: type[BaseModel]) -> str:
    """
    Generate a JSON schema string optimized for LLM consumption
    
    Args:
        schema_class: Pydantic model class
        
    Returns:
        str: JSON schema as string for LLM prompts
    """
    schema = schema_class.model_json_schema()
    
    # Simplify schema for LLM consumption
    simplified = {
        "type": "object",
        "properties": {},
        "required": schema.get("required", [])
    }
    
    for field_name, field_schema in schema.get("properties", {}).items():
        simplified["properties"][field_name] = {
            "type": field_schema.get("type", "string"),
            "description": field_schema.get("description", "")
        }
        
        # Add enum values if present
        if "enum" in field_schema:
            simplified["properties"][field_name]["enum"] = field_schema["enum"]
    
    return json.dumps(simplified, indent=2)

def create_llm_prompt_with_schema(
    task_description: str,
    schema_class: type[BaseModel],
    examples: Optional[List[Dict[str, Any]]] = None
) -> str:
    """
    Create an LLM prompt with embedded JSON schema
    
    Args:
        task_description: Description of the task
        schema_class: Pydantic model class for expected output
        examples: Optional list of example outputs
        
    Returns:
        str: Complete prompt with schema
    """
    schema_str = generate_json_schema_for_llm(schema_class)
    
    prompt = f"""Task: {task_description}

You must respond with valid JSON that exactly matches this schema:

{schema_str}

Requirements:
- All fields marked as required must be present
- Follow the exact field names and types specified
- Ensure enum values match exactly (case-sensitive)
- Addresses must be valid Ethereum addresses (0x + 40 hex chars)
- Bytes32 values must be 0x + 64 hex chars
- Confidence scores must be between 0 and 1

"""

    if examples:
        prompt += "Examples of valid responses:\n\n"
        for i, example in enumerate(examples):
            prompt += f"Example {i+1}:\n{json.dumps(example, indent=2)}\n\n"
    
    prompt += "Respond with valid JSON only. Do not include any additional text or explanation."
    
    return prompt

# ============ Export Schema Registry ============

CONTRACT_SCHEMAS = {
    # Core Oracle Interfaces
    "OracleData": OracleData,
    "PriceData": PriceData,
    "ResolutionData": ResolutionData,
    
    # Router Schemas
    "RouteConfig": RouteConfig,
    "RouteResult": RouteResult,
    
    # Prediction Market Schemas
    "Market": Market,
    "Position": Position,
    
    # LLM Response Schemas
    "OracleRoutingResponse": OracleRoutingResponse,
    "PredictionMarketResolution": PredictionMarketResolution,
    "OracleDataValidation": OracleDataValidation
}

def get_schema(schema_name: str) -> type[BaseModel]:
    """Get a schema class by name"""
    return CONTRACT_SCHEMAS[schema_name]

def list_available_schemas() -> List[str]:
    """List all available schema names"""
    return list(CONTRACT_SCHEMAS.keys())