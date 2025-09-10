"""
Main OpenOracle API client
High-level interface combining all API functionality
"""

from typing import Optional, Dict, Any, List, Union
from decimal import Decimal
import logging

from ..core.config import OracleConfig, get_config
from ..core.client import OpenOracleClient
from ..core.exceptions import OracleError
from ..schemas.oracle_schemas import (
    OracleProvider,
    DataCategory,
    OracleRoutingRequest,
    OracleRoutingResponse,
    OracleDataPoint,
    PriceFeedData,
    AggregatedPrice,
    OracleHealthCheck
)
from .oracle_api import OracleAPI
from .twitter_api import TwitterAPI
from .poll_api import PollAPI

logger = logging.getLogger(__name__)


class OpenOracleAPI:
    """
    Main API client for OpenOracle
    Provides unified access to all functionality
    """
    
    def __init__(self, config: Optional[OracleConfig] = None):
        """
        Initialize OpenOracle API client
        
        Args:
            config: Optional configuration. If not provided, loads from environment
        """
        self.config = config or get_config()
        self.client = OpenOracleClient(self.config)
        
        # Sub-API clients
        self.oracle = OracleAPI(self.client)
        self.twitter = TwitterAPI(self.client)
        self.polls = PollAPI(self.client)
        
    async def __aenter__(self):
        """Async context manager entry"""
        await self.client.start()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.client.close()
    
    # ============ Oracle Routing Methods ============
    
    async def route_question(
        self,
        question: str,
        category_hint: Optional[DataCategory] = None,
        required_chains: Optional[List[str]] = None,
        max_latency_ms: Optional[int] = None,
        max_cost_usd: Optional[Decimal] = None,
        preferred_providers: Optional[List[OracleProvider]] = None
    ) -> OracleRoutingResponse:
        """
        Route a question to the most appropriate oracle
        
        Args:
            question: The question to analyze and route
            category_hint: Hint about the data category
            required_chains: List of required blockchain networks
            max_latency_ms: Maximum acceptable latency in milliseconds
            max_cost_usd: Maximum acceptable cost in USD
            preferred_providers: List of preferred oracle providers
            
        Returns:
            OracleRoutingResponse with routing decision
        """
        return await self.oracle.route_question(
            question=question,
            category_hint=category_hint,
            required_chains=required_chains,
            max_latency_ms=max_latency_ms,
            max_cost_usd=max_cost_usd,
            preferred_providers=preferred_providers
        )
    
    async def get_oracle_capabilities(self) -> Dict[str, List[str]]:
        """Get capabilities of all supported oracle providers"""
        return await self.oracle.get_supported_feeds()
    
    async def get_oracle_health(self) -> Dict[str, Any]:
        """Get health status of all oracle providers"""
        return await self.oracle.get_health_status()
    
    # ============ Price Feed Methods ============
    
    async def get_price(
        self,
        asset: str = "ETH/USD",
        provider: Optional[OracleProvider] = None,
        chain: Optional[str] = None
    ) -> Union[PriceFeedData, AggregatedPrice]:
        """
        Get current price for an asset
        
        Args:
            asset: Asset pair (e.g., 'ETH/USD', 'BTC/USD')
            provider: Specific provider to use (if None, uses aggregated data)
            chain: Blockchain network to query
            
        Returns:
            Price data from specified provider or aggregated from multiple
        """
        if provider:
            if provider == OracleProvider.CHAINLINK:
                return await self.oracle.get_chainlink_price(asset, chain or "ethereum")
            elif provider == OracleProvider.PYTH:
                return await self.oracle.get_pyth_price(asset, chain or "ethereum")
            else:
                raise OracleError(f"Price feeds not implemented for {provider}")
        else:
            return await self.oracle.get_aggregated_price(asset)
    
    async def get_price_history(
        self,
        asset: str,
        timeframe: str = "1d",
        provider: Optional[OracleProvider] = None
    ) -> List[Dict[str, Any]]:
        """Get historical price data (not implemented in base API yet)"""
        # This would be implemented when the backend supports historical data
        raise NotImplementedError("Historical price data not yet supported")
    
    # ============ Poll/Market Methods ============
    
    async def create_prediction_market(
        self,
        question: str,
        poll_id: str,
        auto_resolve: bool = True,
        category_hint: Optional[DataCategory] = None
    ) -> Dict[str, Any]:
        """
        Create a prediction market with oracle backing
        
        Args:
            question: The prediction question
            poll_id: Unique identifier for the poll
            auto_resolve: Whether to automatically resolve using oracle data
            category_hint: Hint about the data category
            
        Returns:
            Poll creation response with oracle configuration
        """
        return await self.polls.create_oracle_poll({
            'question': question,
            'poll_id': poll_id,
            'auto_resolve': auto_resolve,
            'category_hint': category_hint.value if category_hint else None
        })
    
    async def get_market(self, poll_id: str) -> Dict[str, Any]:
        """Get details of a specific prediction market"""
        return await self.polls.get_poll(poll_id)
    
    async def list_markets(self, filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """List prediction markets with optional filters"""
        return await self.polls.list_polls(filters or {})
    
    async def resolve_market(self, poll_id: str) -> Dict[str, Any]:
        """Manually trigger resolution of a prediction market"""
        # This would call a resolution endpoint when implemented
        raise NotImplementedError("Manual market resolution not yet supported")
    
    # ============ Twitter Integration Methods ============
    
    async def analyze_tweet(
        self,
        tweet_text: str,
        author: Optional[str] = None,
        tweet_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze a tweet for prediction market potential
        
        Args:
            tweet_text: The tweet content
            author: Tweet author (optional)
            tweet_id: Tweet ID (optional)
            
        Returns:
            Analysis results with prediction market suggestions
        """
        return await self.twitter.analyze_tweet({
            'content': tweet_text,
            'author': author,
            'tweet_id': tweet_id
        })
    
    async def create_market_from_tweet(
        self,
        tweet_text: str,
        poll_id: str,
        author: Optional[str] = None,
        tweet_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a prediction market directly from a tweet
        
        Args:
            tweet_text: The tweet content
            poll_id: Unique identifier for the poll
            author: Tweet author (optional)
            tweet_id: Tweet ID (optional)
            
        Returns:
            Created poll with oracle routing
        """
        # First analyze the tweet
        analysis = await self.analyze_tweet(tweet_text, author, tweet_id)
        
        # Extract question from analysis
        question = analysis.get('suggested_question', tweet_text)
        category = analysis.get('category')
        
        # Create the market
        return await self.create_prediction_market(
            question=question,
            poll_id=poll_id,
            auto_resolve=True,
            category_hint=DataCategory(category) if category else None
        )
    
    # ============ Utility Methods ============
    
    async def health_check(self) -> Dict[str, Any]:
        """Check overall system health"""
        try:
            oracle_health = await self.get_oracle_health()
            
            return {
                'status': 'healthy',
                'timestamp': None,  # Would be filled by server
                'oracle_providers': oracle_health,
                'api_version': '0.1.0'
            }
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': None
            }
    
    async def get_supported_assets(self, provider: Optional[OracleProvider] = None) -> List[str]:
        """Get list of supported assets for price feeds"""
        capabilities = await self.get_oracle_capabilities()
        
        if provider:
            return capabilities.get(provider.value, {}).get('price', [])
        else:
            # Combine all provider assets
            all_assets = set()
            for provider_caps in capabilities.values():
                if 'price' in provider_caps:
                    all_assets.update(provider_caps['price'])
            return sorted(list(all_assets))
    
    async def get_supported_sports(self, provider: Optional[OracleProvider] = None) -> List[str]:
        """Get list of supported sports for sports betting markets"""
        capabilities = await self.get_oracle_capabilities()
        
        if provider:
            return capabilities.get(provider.value, {}).get('sports', [])
        else:
            all_sports = set()
            for provider_caps in capabilities.values():
                if 'sports' in provider_caps:
                    all_sports.update(provider_caps['sports'])
            return sorted(list(all_sports))
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get API client metrics"""
        return self.client.get_metrics_summary()
    
    def clear_metrics(self):
        """Clear stored metrics"""
        self.client.clear_metrics()
    
    def update_config(self, **kwargs):
        """Update configuration dynamically"""
        for key, value in kwargs.items():
            if hasattr(self.config, key):
                setattr(self.config, key, value)
    
    # ============ Batch Operations ============
    
    async def batch_price_feeds(
        self,
        assets: List[str],
        provider: Optional[OracleProvider] = None
    ) -> List[Union[PriceFeedData, AggregatedPrice]]:
        """Get multiple price feeds in a single request"""
        results = []
        
        # For now, make individual requests
        # TODO: Implement true batch API endpoint
        for asset in assets:
            try:
                price = await self.get_price(asset, provider)
                results.append(price)
            except Exception as e:
                logger.warning(f"Failed to get price for {asset}: {e}")
                results.append(None)
        
        return results
    
    async def batch_route_questions(
        self,
        questions: List[str]
    ) -> List[OracleRoutingResponse]:
        """Route multiple questions in batch"""
        results = []
        
        # For now, make individual requests
        # TODO: Implement true batch API endpoint
        for question in questions:
            try:
                routing = await self.route_question(question)
                results.append(routing)
            except Exception as e:
                logger.warning(f"Failed to route question '{question}': {e}")
                results.append(None)
        
        return results