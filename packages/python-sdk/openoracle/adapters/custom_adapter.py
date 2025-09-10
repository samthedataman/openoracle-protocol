"""
Custom Oracle Adapter Template for OpenOracle Protocol

This template shows how to create your own oracle adapter for any data source.
Simply inherit from BaseOracleAdapter and implement the required methods.
"""

import aiohttp
import asyncio
from typing import Dict, List, Any
from .base_adapter import BaseOracleAdapter, OracleRequest, DataType

class CustomOracleAdapter(BaseOracleAdapter):
    """
    Template for creating custom oracle adapters.
    
    Replace this with your own oracle provider implementation.
    
    Usage:
        adapter = CustomOracleAdapter({
            'api_key': 'your-api-key',
            'base_url': 'https://api.your-oracle.com',
            'custom_param': 'value'
        })
        
        response = await adapter.query(OracleRequest(
            query='your-query',
            data_type=DataType.CUSTOM
        ))
    """
    
    def _get_adapter_name(self) -> str:
        """Return your oracle provider name"""
        return "custom-oracle"
    
    def _get_adapter_version(self) -> str:
        """Return adapter version"""
        return "1.0.0"
    
    def _get_supported_data_types(self) -> List[DataType]:
        """Return list of data types your oracle supports"""
        return [DataType.CUSTOM, DataType.NEWS, DataType.SOCIAL]
    
    async def _execute_query(self, request: OracleRequest) -> Any:
        """
        Execute your oracle query logic here.
        
        This is where you implement the actual API calls or data fetching
        logic for your oracle provider.
        """
        
        if request.data_type == DataType.CUSTOM:
            return await self._get_custom_data(request.query, request.parameters)
        elif request.data_type == DataType.NEWS:
            return await self._get_news_data(request.query)
        elif request.data_type == DataType.SOCIAL:
            return await self._get_social_data(request.query)
        else:
            raise ValueError(f"Unsupported data type: {request.data_type}")
    
    async def _get_custom_data(self, query: str, parameters: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Implement your custom data fetching logic.
        
        Example implementation for a REST API:
        """
        base_url = self.config.get('base_url', 'https://api.your-oracle.com')
        api_key = self.config.get('api_key')
        
        headers = {
            'Content-Type': 'application/json'
        }
        if api_key:
            headers['Authorization'] = f'Bearer {api_key}'
        
        async with aiohttp.ClientSession() as session:
            url = f"{base_url}/query"
            payload = {
                'query': query,
                'parameters': parameters or {}
            }
            
            async with session.post(url, json=payload, headers=headers) as response:
                response.raise_for_status()
                data = await response.json()
                
                # Transform the response to your desired format
                return {
                    'result': data.get('result'),
                    'query': query,
                    'timestamp': data.get('timestamp'),
                    'source': 'custom-oracle',
                    'metadata': data.get('metadata', {})
                }
    
    async def _get_news_data(self, query: str) -> Dict[str, Any]:
        """Example: Get news data from your oracle"""
        # Implement news data fetching
        return {
            'query': query,
            'articles': [
                {
                    'title': 'Example News Article',
                    'summary': 'This is a sample news article',
                    'sentiment': 'neutral',
                    'confidence': 0.85
                }
            ]
        }
    
    async def _get_social_data(self, query: str) -> Dict[str, Any]:
        """Example: Get social media data from your oracle"""
        # Implement social media data fetching
        return {
            'query': query,
            'posts': [
                {
                    'text': 'Sample social media post',
                    'platform': 'twitter',
                    'sentiment': 'positive',
                    'engagement': 100
                }
            ]
        }
    
    def _calculate_confidence(self, data: Any, request: OracleRequest) -> float:
        """
        Calculate confidence score for your oracle responses.
        
        Override this method to implement your own confidence calculation
        based on factors like:
        - Data freshness
        - Source reliability  
        - Response completeness
        - Historical accuracy
        """
        if not data:
            return 0.0
        
        # Example confidence calculation
        if 'confidence' in data:
            return float(data['confidence'])
        
        # Default confidence based on data completeness
        if 'result' in data and data['result']:
            return 0.8
        
        return 0.5
    
    def _calculate_cost(self, request: OracleRequest) -> float:
        """
        Calculate cost for your oracle queries.
        
        Override this to implement your pricing model:
        - Per-query pricing
        - Tiered pricing by data type
        - Volume discounts
        - Free tier limits
        """
        # Example pricing
        pricing = {
            DataType.CUSTOM: 0.01,    # $0.01 per custom query
            DataType.NEWS: 0.005,     # $0.005 per news query  
            DataType.SOCIAL: 0.002    # $0.002 per social query
        }
        
        return pricing.get(request.data_type, 0.01)
    
    def _get_response_metadata(self, request: OracleRequest) -> Dict[str, Any]:
        """
        Add custom metadata to responses.
        
        This can include provider-specific information, debugging data,
        or additional context about the response.
        """
        return {
            'provider': self.name,
            'version': self.version,
            'region': self.config.get('region', 'us-east-1'),
            'custom_field': 'custom_value'
        }
    
    async def _health_check_query(self) -> Any:
        """
        Implement a lightweight health check for your oracle.
        
        This should be a simple query that verifies your oracle is
        responding correctly. It's used for monitoring and routing.
        """
        try:
            # Simple health check query
            return await self._get_custom_data('health-check', {'test': True})
        except Exception as e:
            raise Exception(f"Health check failed: {str(e)}")

# Example of how to create a specialized adapter
class TwitterOracleAdapter(CustomOracleAdapter):
    """
    Specialized adapter for Twitter data.
    
    This shows how you can inherit from the custom adapter
    to create more specific implementations.
    """
    
    def _get_adapter_name(self) -> str:
        return "twitter-oracle"
    
    def _get_supported_data_types(self) -> List[DataType]:
        return [DataType.SOCIAL, DataType.NEWS]
    
    async def _execute_query(self, request: OracleRequest) -> Any:
        """Twitter-specific query execution"""
        if request.data_type == DataType.SOCIAL:
            return await self._get_twitter_sentiment(request.query)
        elif request.data_type == DataType.NEWS:
            return await self._get_twitter_news(request.query)
    
    async def _get_twitter_sentiment(self, query: str) -> Dict[str, Any]:
        """Get Twitter sentiment for a topic"""
        # Implement Twitter API integration
        return {
            'query': query,
            'sentiment': 'bullish',
            'confidence': 0.85,
            'tweet_count': 1250,
            'engagement': 50000
        }
    
    async def _get_twitter_news(self, query: str) -> Dict[str, Any]:
        """Get trending news from Twitter"""
        # Implement Twitter news detection
        return {
            'query': query,
            'trending_topics': ['blockchain', 'defi', 'nft'],
            'top_tweets': []
        }