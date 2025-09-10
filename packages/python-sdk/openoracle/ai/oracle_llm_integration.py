"""
Oracle-LLM Integration Module

Combines the LLM providers with Oracle contract JSON schemas
to ensure all AI-generated responses match smart contract structures exactly.
"""

import json
import asyncio
from typing import Dict, List, Optional, Any, Union, Type
from decimal import Decimal

from ..schemas.contract_json_schemas import (
    OracleRoutingResponse,
    PredictionMarketResolution,
    OracleDataValidation,
    RouteResult,
    OracleData,
    PriceData,
    ResolutionData,
    OracleProvider,
    MarketStatus,
    create_llm_prompt_with_schema,
    validate_contract_compatibility,
    CONTRACT_SCHEMAS
)

from .llm_providers import (
    LLMRouter,
    ChatMessage,
    MessageRole,
    LLMRequest,
    LLMResponse,
    generate_json_response
)

class OracleLLMIntegration:
    """
    Integration class that combines LLM providers with Oracle contract schemas
    to ensure AI responses match blockchain contract structures exactly.
    """
    
    def __init__(self, llm_router: LLMRouter):
        self.llm_router = llm_router
    
    async def select_optimal_oracle(
        self,
        question: str,
        data_category: str,
        available_providers: List[str],
        context: Optional[Dict[str, Any]] = None
    ) -> OracleRoutingResponse:
        """
        Use LLM to select the optimal oracle provider for a given question.
        
        Args:
            question: The prediction market question
            data_category: Category of data (price, sports, election, etc.)
            available_providers: List of available oracle providers
            context: Additional context information
            
        Returns:
            OracleRoutingResponse: Validated response matching contract structure
        """
        
        # Map string providers to enum
        provider_enums = []
        for provider in available_providers:
            try:
                provider_enums.append(OracleProvider(provider.upper()))
            except ValueError:
                continue  # Skip invalid providers
        
        if not provider_enums:
            raise ValueError("No valid oracle providers available")
        
        system_prompt = f"""You are an expert oracle routing system for blockchain prediction markets.

Your task is to analyze prediction market questions and select the optimal oracle provider based on:

1. **Data Type Suitability**: Different oracles excel at different data types
   - CHAINLINK: Best for price feeds, economic data, some sports
   - PYTH: Optimal for high-frequency price data, crypto markets  
   - UMA: Perfect for subjective/disputed questions requiring human verification
   - API3: Good for direct API integrations, weather, custom data
   - CUSTOM: For specialized data not covered by standard oracles

2. **Reliability & Speed**: Consider update frequency and data quality
3. **Cost Efficiency**: Balance cost vs quality based on question importance
4. **Resolution Method**: Match oracle capabilities to question resolution needs

Available providers for this question: {[p.value for p in provider_enums]}
Data category: {data_category}

Analyze the question thoroughly and provide detailed reasoning for your selection."""

        user_prompt = f"""Question: "{question}"

Additional context: {json.dumps(context) if context else "None"}

Select the optimal oracle provider and provide detailed reasoning."""

        messages = [
            ChatMessage(role=MessageRole.SYSTEM, content=system_prompt),
            ChatMessage(role=MessageRole.USER, content=user_prompt)
        ]
        
        # Create prompt with schema validation
        schema_prompt = create_llm_prompt_with_schema(
            task_description="Select the optimal oracle provider for the prediction market question",
            schema_class=OracleRoutingResponse,
            examples=[{
                "selected_oracle": "CHAINLINK",
                "reasoning": "Chainlink is optimal for BTC price data due to its robust aggregation of multiple high-quality price feeds with proven reliability and sub-minute updates",
                "confidence": 0.92,
                "estimated_cost": 0.25,
                "estimated_time": 30,
                "fallback_options": ["PYTH", "API3"]
            }]
        )
        
        # Override user message with schema prompt
        messages[-1].content = schema_prompt
        
        # Generate response with JSON validation
        response_json = await generate_json_response(
            messages=messages,
            router=self.llm_router,
            model="gpt-4o-mini",
            temperature=0.3  # Lower temperature for more consistent routing decisions
        )
        
        # Validate and parse response
        try:
            oracle_response = OracleRoutingResponse.model_validate(response_json)
            
            # Additional validation - ensure selected oracle is in available providers
            if oracle_response.selected_oracle not in provider_enums:
                # Fallback to first available provider
                oracle_response.selected_oracle = provider_enums[0]
                oracle_response.reasoning += f" (Fallback selection as original choice was unavailable)"
                oracle_response.confidence *= 0.8  # Reduce confidence due to fallback
            
            return oracle_response
            
        except Exception as e:
            # Fallback response if validation fails
            return OracleRoutingResponse(
                selected_oracle=provider_enums[0],
                reasoning=f"Fallback selection due to parsing error: {str(e)}",
                confidence=0.5,
                fallback_options=provider_enums[1:3] if len(provider_enums) > 1 else []
            )
    
    async def resolve_prediction_market(
        self,
        question: str,
        options: List[str],
        resolution_data: Dict[str, Any],
        oracle_provider: str
    ) -> PredictionMarketResolution:
        """
        Use LLM to resolve a prediction market question based on provided data.
        
        Args:
            question: The original prediction market question
            options: List of possible outcomes
            resolution_data: Real-world data to resolve the question
            oracle_provider: The oracle provider used
            
        Returns:
            PredictionMarketResolution: Validated resolution matching contract structure
        """
        
        system_prompt = f"""You are an impartial prediction market resolution system.

Your task is to objectively resolve prediction market questions based on verifiable data.

Resolution Guidelines:
1. **Objectivity**: Base decisions solely on factual data
2. **Accuracy**: Ensure the winning outcome matches the data precisely  
3. **Transparency**: Provide clear reasoning citing specific data points
4. **Confidence**: Only high-confidence resolutions (>0.8) should resolve immediately
5. **Data Sources**: Reference all data sources used in your analysis

Oracle Provider: {oracle_provider}
This affects the type and reliability of data available for resolution."""

        options_text = "\n".join([f"{i}: {option}" for i, option in enumerate(options)])
        
        user_prompt = f"""Question: "{question}"

Available Options:
{options_text}

Resolution Data: {json.dumps(resolution_data, indent=2)}

Analyze the data and determine which option (by index number) should win.
Provide detailed reasoning and cite specific data sources."""

        messages = [
            ChatMessage(role=MessageRole.SYSTEM, content=system_prompt),
            ChatMessage(role=MessageRole.USER, content=user_prompt)
        ]
        
        # Create prompt with schema validation
        schema_prompt = create_llm_prompt_with_schema(
            task_description="Resolve the prediction market question based on the provided data",
            schema_class=PredictionMarketResolution,
            examples=[{
                "winning_outcome": 0,
                "resolution_value": 105000,
                "confidence": 0.98,
                "data_sources": ["coinbase", "binance", "kraken_spot"],
                "reasoning": "Bitcoin price reached $105,000 on December 15, 2024, exceeding the $100k threshold. This was confirmed across multiple major exchanges with consistent pricing.",
                "timestamp": 1734220800
            }]
        )
        
        messages[-1].content = schema_prompt
        
        # Generate response with JSON validation
        response_json = await generate_json_response(
            messages=messages,
            router=self.llm_router,
            model="gpt-4o-mini",
            temperature=0.1  # Very low temperature for objective resolution
        )
        
        # Validate and parse response
        try:
            resolution = PredictionMarketResolution.model_validate(response_json)
            
            # Additional validation
            if resolution.winning_outcome >= len(options):
                resolution.winning_outcome = 0  # Default to first option if invalid
                resolution.confidence *= 0.5   # Reduce confidence
                resolution.reasoning += " (Corrected invalid outcome index)"
            
            return resolution
            
        except Exception as e:
            # Fallback resolution if validation fails
            return PredictionMarketResolution(
                winning_outcome=0,
                confidence=0.3,  # Low confidence due to error
                data_sources=["fallback"],
                reasoning=f"Could not parse resolution data properly: {str(e)}. Defaulting to first option.",
                timestamp=int(asyncio.get_event_loop().time())
            )
    
    async def validate_oracle_data(
        self,
        data_points: List[Dict[str, Any]],
        expected_data_type: str,
        quality_threshold: float = 0.8
    ) -> OracleDataValidation:
        """
        Use LLM to validate oracle data quality and detect anomalies.
        
        Args:
            data_points: List of oracle data points to validate
            expected_data_type: The expected type of data (price, score, etc.)
            quality_threshold: Minimum quality score for validation
            
        Returns:
            OracleDataValidation: Validation results matching contract structure
        """
        
        system_prompt = f"""You are an oracle data validation system for blockchain applications.

Your task is to analyze oracle data for quality, consistency, and anomalies.

Validation Criteria:
1. **Data Consistency**: Values should be consistent across sources
2. **Freshness**: Data should be recent (timestamp validation)
3. **Range Validation**: Values should be within expected ranges
4. **Anomaly Detection**: Identify outliers or suspicious patterns
5. **Source Reliability**: Assess the reliability of data sources

Expected Data Type: {expected_data_type}
Quality Threshold: {quality_threshold}

Provide a comprehensive analysis of the data quality."""

        user_prompt = f"""Data Points to Validate:
{json.dumps(data_points, indent=2)}

Analyze this data for quality issues, anomalies, and overall reliability.
Provide specific recommendations for improvement."""

        messages = [
            ChatMessage(role=MessageRole.SYSTEM, content=system_prompt),
            ChatMessage(role=MessageRole.USER, content=user_prompt)
        ]
        
        # Create prompt with schema validation
        schema_prompt = create_llm_prompt_with_schema(
            task_description="Validate the oracle data quality and detect any anomalies",
            schema_class=OracleDataValidation,
            examples=[{
                "is_valid": True,
                "confidence_score": 0.94,
                "anomaly_detected": False,
                "data_freshness": 45,
                "source_reliability": 0.96,
                "issues": [],
                "recommendations": ["Consider adding more data sources for cross-validation"]
            }]
        )
        
        messages[-1].content = schema_prompt
        
        # Generate response with JSON validation
        response_json = await generate_json_response(
            messages=messages,
            router=self.llm_router,
            model="gpt-4o-mini",
            temperature=0.2  # Low temperature for consistent validation
        )
        
        # Validate and parse response
        try:
            validation = OracleDataValidation.model_validate(response_json)
            
            # Apply quality threshold
            if validation.confidence_score < quality_threshold:
                validation.is_valid = False
                validation.issues.append(f"Confidence score {validation.confidence_score} below threshold {quality_threshold}")
            
            return validation
            
        except Exception as e:
            # Fallback validation if parsing fails
            return OracleDataValidation(
                is_valid=False,
                confidence_score=0.0,
                anomaly_detected=True,
                data_freshness=999999,  # Very old
                source_reliability=0.0,
                issues=[f"Validation system error: {str(e)}"],
                recommendations=["Manual review required due to validation error"]
            )
    
    async def generate_oracle_query_params(
        self,
        question: str,
        oracle_provider: OracleProvider,
        data_category: str
    ) -> Dict[str, Any]:
        """
        Generate oracle-specific query parameters for a prediction market question.
        
        Args:
            question: The prediction market question
            oracle_provider: The selected oracle provider
            data_category: Category of data needed
            
        Returns:
            Dict with oracle-specific parameters
        """
        
        system_prompt = f"""You are an oracle integration specialist.

Your task is to generate the correct query parameters for different oracle providers based on prediction market questions.

Oracle Provider: {oracle_provider.value}
Data Category: {data_category}

Generate appropriate parameters for this oracle to resolve the prediction market question."""

        user_prompt = f"""Question: "{question}"

Generate the oracle query parameters needed to resolve this question.
Consider the specific requirements and format for {oracle_provider.value} oracle."""

        messages = [
            ChatMessage(role=MessageRole.SYSTEM, content=system_prompt),
            ChatMessage(role=MessageRole.USER, content=user_prompt)
        ]
        
        response_json = await generate_json_response(
            messages=messages,
            router=self.llm_router,
            model="gpt-4o-mini",
            temperature=0.2
        )
        
        return response_json
    
    def get_supported_schemas(self) -> List[str]:
        """Get list of supported contract schema names"""
        return list(CONTRACT_SCHEMAS.keys())
    
    def validate_response_format(
        self,
        response: Dict[str, Any],
        schema_name: str
    ) -> bool:
        """
        Validate that a response matches the expected contract schema.
        
        Args:
            response: The response dictionary to validate
            schema_name: Name of the schema to validate against
            
        Returns:
            bool: True if response is valid
        """
        if schema_name not in CONTRACT_SCHEMAS:
            return False
        
        try:
            schema_class = CONTRACT_SCHEMAS[schema_name]
            schema_class.model_validate(response)
            return True
        except Exception:
            return False


# ============ Convenience Functions ============

async def create_oracle_llm_integration(
    openai_key: Optional[str] = None,
    openrouter_key: Optional[str] = None,
    enable_webllm: bool = False
) -> OracleLLMIntegration:
    """
    Create an OracleLLMIntegration with default configuration.
    
    Args:
        openai_key: OpenAI API key
        openrouter_key: OpenRouter API key  
        enable_webllm: Whether to enable WebLLM
        
    Returns:
        OracleLLMIntegration instance
    """
    from .llm_providers import create_llm_router
    
    router = create_llm_router(
        openai_key=openai_key,
        openrouter_key=openrouter_key,
        enable_webllm=enable_webllm
    )
    
    return OracleLLMIntegration(router)

async def route_oracle_for_question(
    question: str,
    available_providers: List[str],
    integration: OracleLLMIntegration,
    context: Optional[Dict[str, Any]] = None
) -> OracleRoutingResponse:
    """
    Quick function to route a question to the optimal oracle.
    
    Args:
        question: Prediction market question
        available_providers: List of available oracle providers
        integration: Oracle LLM integration instance
        context: Additional context
        
    Returns:
        OracleRoutingResponse with selected oracle
    """
    # Determine data category from question
    data_category = "custom"  # Default
    question_lower = question.lower()
    
    if any(word in question_lower for word in ["price", "cost", "value", "$", "usd", "btc", "eth"]):
        data_category = "price"
    elif any(word in question_lower for word in ["election", "vote", "president", "candidate"]):
        data_category = "election"
    elif any(word in question_lower for word in ["game", "score", "team", "match", "sport"]):
        data_category = "sports"
    elif any(word in question_lower for word in ["weather", "temperature", "rain", "storm"]):
        data_category = "weather"
    
    return await integration.select_optimal_oracle(
        question=question,
        data_category=data_category,
        available_providers=available_providers,
        context=context
    )