"""
Pyth Network Oracle Adapter for OpenOracle Protocol

Provides integration with Pyth Network's high-frequency price feeds
optimized for DeFi applications.
"""

import aiohttp
import asyncio
from typing import Dict, List, Any
from .base_adapter import BaseOracleAdapter, OracleRequest, DataType

class PythAdapter(BaseOracleAdapter):
    """
    Pyth Network oracle adapter for high-frequency price feeds.
    
    Usage:
        adapter = PythAdapter({
            'api_key': 'your-pyth-api-key',
            'base_url': 'https://hermes.pyth.network/v2'
        })
        
        response = await adapter.query(OracleRequest(
            query='BTC/USD',
            data_type=DataType.PRICE
        ))
    """
    
    def _get_adapter_name(self) -> str:
        return "pyth"
    
    def _get_adapter_version(self) -> str:
        return "1.0.0"
    
    def _get_supported_data_types(self) -> List[DataType]:
        return [DataType.PRICE]  # Pyth specializes in price feeds
    
    async def _execute_query(self, request: OracleRequest) -> Any:
        """Execute Pyth oracle query"""
        
        if request.data_type == DataType.PRICE:
            return await self._get_price_feed(request.query)
        else:
            raise ValueError(f"Unsupported data type: {request.data_type}")
    
    async def _get_price_feed(self, pair: str) -> Dict[str, Any]:
        """Get high-frequency price feed from Pyth"""
        base_url = self.config.get('base_url', 'https://hermes.pyth.network/v2')
        
        # Map common pair formats to Pyth price feed IDs
        price_feed_ids = {
            'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
            'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
            'SOL/USD': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d'
        }
        
        feed_id = price_feed_ids.get(pair.upper())
        if not feed_id:
            raise ValueError(f"Unsupported trading pair: {pair}")
        
        async with aiohttp.ClientSession() as session:
            url = f"{base_url}/updates/price/latest"
            params = {'ids[]': feed_id}
            
            async with session.get(url, params=params) as response:
                response.raise_for_status()
                data = await response.json()
                
                if not data.get('parsed'):
                    raise ValueError("No price data available")
                
                price_data = data['parsed'][0]
                price_info = price_data['price']
                
                return {
                    'price': float(price_info['price']) * (10 ** price_info['expo']),
                    'pair': pair,
                    'confidence_interval': float(price_info['conf']) * (10 ** price_info['expo']),
                    'publish_time': price_data['publish_time'],
                    'feed_id': feed_id,
                    'expo': price_info['expo']
                }
    
    def _calculate_confidence(self, data: Any, request: OracleRequest) -> float:
        """Calculate confidence based on Pyth's confidence interval"""
        if not data:
            return 0.0
        
        price = data.get('price', 0)
        confidence_interval = data.get('confidence_interval', 0)
        
        if price == 0:
            return 0.0
        
        # Confidence decreases as the confidence interval increases
        confidence_ratio = confidence_interval / price
        
        if confidence_ratio < 0.001:  # Less than 0.1% uncertainty
            return 0.95
        elif confidence_ratio < 0.005:  # Less than 0.5% uncertainty
            return 0.85
        elif confidence_ratio < 0.01:  # Less than 1% uncertainty
            return 0.75
        else:
            return 0.6
    
    def _calculate_cost(self, request: OracleRequest) -> float:
        """Calculate cost for Pyth query - typically free for basic usage"""
        return 0.0  # Pyth Network is often free for basic queries
    
    def _get_response_metadata(self, request: OracleRequest) -> Dict[str, Any]:
        """Get Pyth-specific response metadata"""
        return {
            'provider': 'pyth',
            'network': 'mainnet',
            'data_source': 'pyth-hermes'
        }
    
    async def _health_check_query(self) -> Any:
        """Pyth health check using BTC/USD"""
        return await self._get_price_feed("BTC/USD")