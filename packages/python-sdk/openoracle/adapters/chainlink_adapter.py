"""
Chainlink Oracle Adapter for OpenOracle Protocol

Provides integration with Chainlink's decentralized oracle network
for price feeds and other data sources.
"""

import aiohttp
import asyncio
from typing import Dict, List, Any
from .base_adapter import BaseOracleAdapter, OracleRequest, DataType

class ChainlinkAdapter(BaseOracleAdapter):
    """
    Chainlink oracle adapter for price feeds and market data.
    
    Usage:
        adapter = ChainlinkAdapter({
            'api_key': 'your-chainlink-api-key',
            'base_url': 'https://api.chain.link/v1'
        })
        
        response = await adapter.query(OracleRequest(
            query='BTC/USD',
            data_type=DataType.PRICE
        ))
    """
    
    def _get_adapter_name(self) -> str:
        return "chainlink"
    
    def _get_adapter_version(self) -> str:
        return "1.0.0"
    
    def _get_supported_data_types(self) -> List[DataType]:
        return [DataType.PRICE, DataType.WEATHER, DataType.SPORTS]
    
    async def _execute_query(self, request: OracleRequest) -> Any:
        """Execute Chainlink oracle query"""
        
        if request.data_type == DataType.PRICE:
            return await self._get_price_feed(request.query)
        elif request.data_type == DataType.WEATHER:
            return await self._get_weather_data(request.query)
        elif request.data_type == DataType.SPORTS:
            return await self._get_sports_data(request.query)
        else:
            raise ValueError(f"Unsupported data type: {request.data_type}")
    
    async def _get_price_feed(self, pair: str) -> Dict[str, Any]:
        """Get price feed from Chainlink"""
        base_url = self.config.get('base_url', 'https://api.chain.link/v1')
        api_key = self.config.get('api_key')
        
        headers = {}
        if api_key:
            headers['Authorization'] = f'Bearer {api_key}'
        
        async with aiohttp.ClientSession() as session:
            url = f"{base_url}/price/{pair}"
            
            async with session.get(url, headers=headers) as response:
                response.raise_for_status()
                data = await response.json()
                
                return {
                    'price': float(data['price']),
                    'pair': pair,
                    'decimals': data.get('decimals', 8),
                    'updated_at': data.get('updatedAt'),
                    'round_id': data.get('roundId')
                }
    
    async def _get_weather_data(self, location: str) -> Dict[str, Any]:
        """Get weather data from Chainlink (example)"""
        # Implement weather data fetching logic
        return {
            'location': location,
            'temperature': 22.5,
            'humidity': 65,
            'description': 'Partly cloudy'
        }
    
    async def _get_sports_data(self, event: str) -> Dict[str, Any]:
        """Get sports data from Chainlink (example)"""
        # Implement sports data fetching logic  
        return {
            'event': event,
            'status': 'completed',
            'score': {'home': 2, 'away': 1}
        }
    
    def _calculate_confidence(self, data: Any, request: OracleRequest) -> float:
        """Calculate confidence based on Chainlink data freshness"""
        if not data:
            return 0.0
        
        # Higher confidence for recent price updates
        if 'updated_at' in data:
            import time
            age_seconds = time.time() - data['updated_at']
            if age_seconds < 60:  # Less than 1 minute old
                return 0.95
            elif age_seconds < 300:  # Less than 5 minutes old
                return 0.85
            else:
                return 0.75
        
        return 0.8  # Default confidence
    
    def _calculate_cost(self, request: OracleRequest) -> float:
        """Calculate cost for Chainlink query"""
        # Chainlink pricing model (example)
        if request.data_type == DataType.PRICE:
            return 0.001  # $0.001 per price query
        return 0.005  # $0.005 for other data types
    
    async def _health_check_query(self) -> Any:
        """Chainlink health check"""
        return await self._get_price_feed("ETH/USD")