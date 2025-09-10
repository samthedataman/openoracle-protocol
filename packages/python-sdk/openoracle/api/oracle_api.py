"""
Oracle-specific API methods
Handles oracle routing, price feeds, and provider interactions
"""

from typing import Optional, Dict, Any, List
from decimal import Decimal
import logging

from ..core.client import OpenOracleClient
from ..schemas.oracle_schemas import (
    OracleProvider,
    DataCategory,
    OracleRoutingRequest,
    OracleRoutingResponse,
    PriceFeedData,
    AggregatedPrice
)

logger = logging.getLogger(__name__)


class OracleAPI:
    """API methods for oracle operations"""
    
    def __init__(self, client: OpenOracleClient):
        self.client = client
    
    # ============ Oracle Routing ============
    
    async def route_question(
        self,
        question: str,
        category_hint: Optional[DataCategory] = None,
        required_chains: Optional[List[str]] = None,
        max_latency_ms: Optional[int] = None,
        max_cost_usd: Optional[Decimal] = None,
        preferred_providers: Optional[List[OracleProvider]] = None
    ) -> OracleRoutingResponse:
        """Route a question to the most appropriate oracle"""
        
        request_data = {
            'question': question
        }
        
        if category_hint:
            request_data['category_hint'] = category_hint.value
        if required_chains:
            request_data['required_chains'] = required_chains
        if max_latency_ms:
            request_data['max_latency_ms'] = max_latency_ms
        if max_cost_usd:
            request_data['max_cost_usd'] = str(max_cost_usd)
        if preferred_providers:
            request_data['preferred_providers'] = [p.value for p in preferred_providers]
        
        response = await self.client.post('/api/oracle/route', json_data=request_data)
        
        # Convert response to OracleRoutingResponse
        return OracleRoutingResponse(
            can_resolve=response['can_resolve'],
            selected_oracle=OracleProvider(response['selected_oracle']) if response.get('selected_oracle') else None,
            reasoning=response['reasoning'],
            oracle_config=response.get('oracle_config'),
            alternatives=[OracleProvider(p) for p in response.get('alternatives', [])],
            data_type=DataCategory(response['data_type']) if response.get('data_type') else None,
            required_feeds=response.get('required_feeds', []),
            estimated_cost_usd=Decimal(response['estimated_cost_usd']) if response.get('estimated_cost_usd') else None,
            estimated_latency_ms=response.get('estimated_latency_ms'),
            confidence_score=response['confidence_score'],
            resolution_method=response.get('resolution_method'),
            update_frequency=response.get('update_frequency')
        )
    
    async def analyze_question_with_ai(self, question: str) -> Dict[str, Any]:
        """Use AI to analyze a question for oracle routing"""
        response = await self.client.post('/api/oracle/analyze', json_data={
            'question': question
        })
        return response
    
    # ============ Price Feeds ============
    
    async def get_chainlink_price(
        self,
        pair: str = "ETH/USD",
        chain: str = "ethereum"
    ) -> PriceFeedData:
        """Get Chainlink price feed data"""
        response = await self.client.get('/api/oracle/chainlink/price-feed', params={
            'pair': pair,
            'chain': chain
        })
        
        return PriceFeedData(
            provider='chainlink',
            pair=response.get('pair'),
            price=response['price'],
            timestamp=response['timestamp'],
            confidence=response.get('confidence'),
            metadata=response.get('metadata', {})
        )
    
    async def get_pyth_price(
        self,
        symbol: str = "BTC/USD", 
        chain: str = "ethereum"
    ) -> PriceFeedData:
        """Get Pyth Network price feed data"""
        response = await self.client.get('/api/oracle/pyth/price-feed', params={
            'symbol': symbol,
            'chain': chain
        })
        
        return PriceFeedData(
            provider='pyth',
            symbol=response.get('symbol'),
            price=response['price'],
            timestamp=response['timestamp'],
            confidence=response.get('confidence'),
            metadata=response.get('metadata', {})
        )
    
    async def get_aggregated_price(
        self,
        asset: str = "ETH/USD",
        providers: Optional[List[str]] = None
    ) -> AggregatedPrice:
        """Get aggregated price from multiple oracle providers"""
        params = {'asset': asset}
        if providers:
            params['providers'] = ','.join(providers)
        
        response = await self.client.get('/api/oracle/aggregated-price', params=params)
        
        return AggregatedPrice(
            asset=response['asset'],
            aggregated_price=response['aggregated_price'],
            aggregation_method=response['aggregation_method'],
            providers=response['providers'],
            individual_values=response['individual_values'],
            confidence=response['confidence'],
            discrepancy_detected=response['discrepancy_detected'],
            timestamp=response['timestamp']
        )
    
    # ============ Oracle Provider Management ============
    
    async def get_supported_feeds(
        self,
        provider: Optional[str] = None,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get supported feeds for oracle providers"""
        params = {}
        if provider:
            params['provider'] = provider
        if category:
            params['category'] = category
        
        return await self.client.get('/api/oracle/supported-feeds', params=params)
    
    async def get_health_status(self) -> Dict[str, Any]:
        """Get health status of all oracle providers"""
        return await self.client.get('/api/oracle/health')
    
    async def get_provider_capabilities(self, provider: OracleProvider) -> Dict[str, Any]:
        """Get detailed capabilities of a specific provider"""
        return await self.client.get(f'/api/oracle/providers/{provider.value}/capabilities')
    
    # ============ Custom Oracle Queries ============
    
    async def query_chainlink_vrf(
        self,
        subscription_id: int,
        num_words: int = 1,
        callback_gas_limit: int = 100000
    ) -> Dict[str, Any]:
        """Request random numbers from Chainlink VRF"""
        response = await self.client.post('/api/oracle/chainlink/vrf', json_data={
            'subscription_id': subscription_id,
            'num_words': num_words,
            'callback_gas_limit': callback_gas_limit
        })
        return response
    
    async def query_chainlink_functions(
        self,
        source_code: str,
        args: List[str],
        subscription_id: int,
        secrets: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Execute Chainlink Functions request"""
        response = await self.client.post('/api/oracle/chainlink/functions', json_data={
            'source_code': source_code,
            'args': args,
            'subscription_id': subscription_id,
            'secrets': secrets or {}
        })
        return response
    
    async def query_uma_optimistic(
        self,
        question: str,
        identifier: str = "YES_OR_NO_QUERY",
        bond_amount: str = "100",
        currency: str = "USDC"
    ) -> Dict[str, Any]:
        """Submit question to UMA Optimistic Oracle"""
        response = await self.client.post('/api/oracle/uma/optimistic', json_data={
            'question': question,
            'identifier': identifier,
            'bond_amount': bond_amount,
            'currency': currency
        })
        return response
    
    async def query_band_custom(
        self,
        oracle_script_id: int,
        calldata: str,
        ask_count: int = 4,
        min_count: int = 3
    ) -> Dict[str, Any]:
        """Execute Band Protocol custom oracle script"""
        response = await self.client.post('/api/oracle/band/custom', json_data={
            'oracle_script_id': oracle_script_id,
            'calldata': calldata,
            'ask_count': ask_count,
            'min_count': min_count
        })
        return response
    
    # ============ Sports Data ============
    
    async def get_sports_data(
        self,
        sport: str = "NFL",
        provider: str = "chainlink"
    ) -> Dict[str, Any]:
        """Get sports data from oracle providers"""
        response = await self.client.get('/api/oracle/sports', params={
            'sport': sport,
            'provider': provider
        })
        return response
    
    async def get_game_result(
        self,
        game_id: str,
        sport: str = "NFL",
        provider: str = "chainlink"
    ) -> Dict[str, Any]:
        """Get specific game result"""
        response = await self.client.get(f'/api/oracle/sports/{sport}/games/{game_id}', params={
            'provider': provider
        })
        return response
    
    # ============ Weather Data ============
    
    async def get_weather_data(
        self,
        location: str,
        provider: str = "api3",
        data_type: str = "current"
    ) -> Dict[str, Any]:
        """Get weather data from oracle providers"""
        response = await self.client.get('/api/oracle/weather', params={
            'location': location,
            'provider': provider,
            'data_type': data_type
        })
        return response
    
    # ============ Economic Data ============
    
    async def get_economic_indicators(
        self,
        indicator: str = "CPI",
        country: str = "US",
        provider: str = "band"
    ) -> Dict[str, Any]:
        """Get economic indicators from oracle providers"""
        response = await self.client.get('/api/oracle/economic', params={
            'indicator': indicator,
            'country': country,
            'provider': provider
        })
        return response
    
    # ============ NFT Data ============
    
    async def get_nft_floor_price(
        self,
        collection: str,
        provider: str = "api3"
    ) -> Dict[str, Any]:
        """Get NFT collection floor price"""
        response = await self.client.get('/api/oracle/nft/floor-price', params={
            'collection': collection,
            'provider': provider
        })
        return response
    
    # ============ Cross-chain Data ============
    
    async def get_cross_chain_data(
        self,
        source_chain: str,
        target_chain: str,
        data_type: str,
        provider: str = "band"
    ) -> Dict[str, Any]:
        """Get cross-chain data transfer"""
        response = await self.client.get('/api/oracle/cross-chain', params={
            'source_chain': source_chain,
            'target_chain': target_chain,
            'data_type': data_type,
            'provider': provider
        })
        return response