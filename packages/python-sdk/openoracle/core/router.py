"""
Main OpenOracle Router Class
Central interface for oracle routing and data retrieval
"""

import logging
from typing import Dict, Any, List, Optional, Union
from datetime import datetime
from decimal import Decimal

from .config import OracleConfig, get_config
from .client import OpenOracleClient
from .exceptions import OracleError, RoutingError, ProviderError
from ..schemas.oracle_schemas import (
    OracleProvider,
    DataCategory,
    OracleRoutingRequest,
    OracleRoutingResponse,
    OracleDataPoint,
    OraclePollData,
    AggregatedOracleData
)
from ..providers.chainlink import ChainlinkProvider
from ..providers.pyth import PythProvider
from ..api.client import OpenOracleAPI

logger = logging.getLogger(__name__)

class OpenOracleRouter:
    """
    Main class for intelligent oracle routing
    Provides a unified interface for all oracle operations
    """
    
    def __init__(
        self,
        openrouter_api_key: Optional[str] = None,
        chainlink_rpc: Optional[str] = None,
        enable_ai_routing: bool = True
    ):
        """
        Initialize OpenOracle Router
        
        Args:
            openrouter_api_key: API key for GPT-4o-mini via OpenRouter
            chainlink_rpc: RPC URL for Chainlink queries
            enable_ai_routing: Whether to use AI for complex routing
        """
        self.enable_ai = enable_ai_routing and openrouter_api_key is not None
        
        if self.enable_ai:
            self.routing_service = EnhancedAIRoutingService(openrouter_api_key)
        else:
            self.routing_service = OracleRoutingEngine()
        
        # Initialize oracle providers
        self.providers = {
            OracleProvider.CHAINLINK: ChainlinkProvider(chainlink_rpc or ""),
            OracleProvider.PYTH: PythProvider(),
            # Add other providers as implemented
        }
        
    async def route_poll_question(
        self,
        question: str,
        category_hint: Optional[DataCategory] = None,
        preferred_chains: Optional[List[str]] = None,
        max_latency_ms: Optional[int] = None,
        max_cost_usd: Optional[Decimal] = None
    ) -> OracleRoutingResponse:
        """
        Route a poll question to the most appropriate oracle
        
        Args:
            question: The poll question to analyze
            category_hint: Optional hint about data category
            preferred_chains: List of preferred blockchain networks
            max_latency_ms: Maximum acceptable latency
            max_cost_usd: Maximum acceptable cost
            
        Returns:
            OracleRoutingResponse with routing decision
        """
        request = OracleRoutingRequest(
            question=question,
            category_hint=category_hint,
            required_chains=preferred_chains,
            max_latency_ms=max_latency_ms,
            max_cost_usd=max_cost_usd
        )
        
        if self.enable_ai:
            return await self.routing_service.route_with_ai(request)
        else:
            return await self.routing_service.route_question(request)
    
    async def get_oracle_data(
        self,
        provider: OracleProvider,
        data_type: DataCategory,
        params: Dict[str, Any]
    ) -> Optional[OracleDataPoint]:
        """
        Get data from a specific oracle provider
        
        Args:
            provider: The oracle provider to use
            data_type: Type of data to retrieve
            params: Provider-specific parameters
            
        Returns:
            OracleDataPoint with the requested data
        """
        oracle_provider = self.providers.get(provider)
        if not oracle_provider:
            logger.error(f"Provider {provider} not implemented")
            return None
        
        try:
            if provider == OracleProvider.CHAINLINK:
                if data_type == DataCategory.PRICE:
                    feed = await oracle_provider.get_price_feed(params.get('pair', 'ETH/USD'))
                    if feed:
                        return await oracle_provider.to_oracle_data_point(feed)
                elif data_type == DataCategory.SPORTS:
                    data = await oracle_provider.get_sports_data(
                        params.get('sport', 'NFL'),
                        params.get('game_id', '')
                    )
                    if data:
                        return OracleDataPoint(
                            provider=provider,
                            data_type=data_type,
                            value=data,
                            timestamp=datetime.utcnow(),
                            confidence=0.95
                        )
                        
            elif provider == OracleProvider.PYTH:
                if data_type == DataCategory.PRICE:
                    feed = await oracle_provider.get_price_feed(params.get('symbol', 'BTC/USD'))
                    if feed:
                        return await oracle_provider.to_oracle_data_point(feed)
                        
        except Exception as e:
            logger.error(f"Failed to get oracle data: {e}")
            
        return None
    
    async def get_aggregated_data(
        self,
        data_type: DataCategory,
        params: Dict[str, Any],
        providers: Optional[List[OracleProvider]] = None
    ) -> Optional[AggregatedOracleData]:
        """
        Get aggregated data from multiple oracle providers
        
        Args:
            data_type: Type of data to retrieve
            params: Parameters for data retrieval
            providers: List of providers to aggregate from
            
        Returns:
            AggregatedOracleData with consensus value
        """
        if not providers:
            # Default to price oracles for price data
            if data_type == DataCategory.PRICE:
                providers = [OracleProvider.CHAINLINK, OracleProvider.PYTH]
            else:
                providers = [OracleProvider.CHAINLINK]
        
        data_points = []
        individual_values = {}
        
        for provider in providers:
            data_point = await self.get_oracle_data(provider, data_type, params)
            if data_point:
                data_points.append(data_point)
                individual_values[provider.value] = data_point.value
        
        if not data_points:
            return None
        
        # Calculate aggregated value (median for numeric data)
        if all(isinstance(dp.value, (int, float)) for dp in data_points):
            values = sorted([dp.value for dp in data_points])
            if len(values) % 2 == 0:
                median_value = (values[len(values)//2 - 1] + values[len(values)//2]) / 2
            else:
                median_value = values[len(values)//2]
            
            # Check for discrepancies (>5% difference)
            max_val = max(values)
            min_val = min(values)
            discrepancy = (max_val - min_val) / max_val > 0.05 if max_val > 0 else False
            
            return AggregatedOracleData(
                data_type=data_type,
                providers=providers,
                aggregation_method="median",
                aggregated_value=median_value,
                individual_values=individual_values,
                timestamp=datetime.utcnow(),
                confidence=0.95 if not discrepancy else 0.8,
                discrepancy_detected=discrepancy
            )
        else:
            # For non-numeric data, return the most recent
            latest_point = max(data_points, key=lambda dp: dp.timestamp)
            return AggregatedOracleData(
                data_type=data_type,
                providers=providers,
                aggregation_method="latest",
                aggregated_value=latest_point.value,
                individual_values=individual_values,
                timestamp=latest_point.timestamp,
                confidence=latest_point.confidence or 0.9,
                discrepancy_detected=False
            )
    
    async def create_oracle_poll(
        self,
        question: str,
        poll_id: str,
        auto_resolve: bool = True
    ) -> Optional[OraclePollData]:
        """
        Create a poll with oracle backing for automatic resolution
        
        Args:
            question: The poll question
            poll_id: Unique identifier for the poll
            auto_resolve: Whether to automatically resolve when data is available
            
        Returns:
            OraclePollData with oracle configuration
        """
        # Route the question to find appropriate oracle
        routing_response = await self.route_poll_question(question)
        
        if not routing_response.can_resolve:
            logger.warning(f"Cannot create oracle-backed poll: {routing_response.reasoning}")
            return None
        
        # Get initial oracle data if available
        initial_data = []
        if routing_response.selected_oracle and routing_response.oracle_config:
            data_point = await self.get_oracle_data(
                routing_response.selected_oracle,
                routing_response.data_type or DataCategory.CUSTOM,
                routing_response.oracle_config
            )
            if data_point:
                initial_data.append(data_point)
        
        # Create poll data structure
        poll_data = OraclePollData(
            poll_id=poll_id,
            oracle_provider=routing_response.selected_oracle,
            data_points=initial_data,
            resolution_criteria=self._build_resolution_criteria(
                question,
                routing_response
            ),
            auto_resolve=auto_resolve
        )
        
        return poll_data
    
    def _build_resolution_criteria(
        self,
        question: str,
        routing: OracleRoutingResponse
    ) -> str:
        """Build resolution criteria based on question and routing"""
        
        criteria = f"Poll resolves based on {routing.selected_oracle.value} oracle data. "
        
        if routing.data_type == DataCategory.PRICE:
            criteria += "Resolution occurs when price threshold is crossed or timeframe expires."
        elif routing.data_type == DataCategory.SPORTS:
            criteria += "Resolution occurs when game result is finalized."
        elif routing.data_type == DataCategory.EVENTS:
            criteria += "Resolution occurs when event outcome is confirmed."
        else:
            criteria += "Resolution based on oracle data availability and consensus."
        
        return criteria
    
    async def resolve_poll(
        self,
        poll_data: OraclePollData
    ) -> Dict[str, Any]:
        """
        Resolve a poll using oracle data
        
        Args:
            poll_data: The poll data with oracle configuration
            
        Returns:
            Resolution result with winning option and proof
        """
        # Get latest oracle data
        if poll_data.oracle_provider:
            # This would contain the actual resolution logic
            # For now, return a mock resolution
            return {
                'resolved': True,
                'winning_option': 'Yes',
                'oracle_value': 100.0,
                'proof': '0x' + '0' * 64,
                'timestamp': datetime.utcnow().isoformat()
            }
        
        return {
            'resolved': False,
            'reason': 'No oracle provider configured'
        }