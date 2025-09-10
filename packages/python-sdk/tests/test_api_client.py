"""
Tests for the main API client
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from decimal import Decimal
import aiohttp

from openoracle.api.client import OpenOracleAPI
from openoracle.core.config import OracleConfig
from openoracle.core.exceptions import NetworkError, AuthenticationError
from openoracle.schemas.oracle_schemas import OracleProvider, DataCategory


@pytest.fixture
def mock_config():
    """Create a mock configuration"""
    return OracleConfig(
        api_key="test-api-key",
        base_url="https://api.openoracle.ai",
        timeout_seconds=30
    )


@pytest.fixture
def api_client(mock_config):
    """Create an API client instance"""
    return OpenOracleAPI(mock_config)


class TestOpenOracleAPI:
    """Test the main API client"""
    
    @pytest.mark.asyncio
    async def test_context_manager(self, mock_config):
        """Test API client as async context manager"""
        async with OpenOracleAPI(mock_config) as api:
            assert api is not None
            assert api.client is not None
    
    @pytest.mark.asyncio
    async def test_route_question(self, api_client):
        """Test question routing"""
        mock_response = {
            'can_resolve': True,
            'selected_oracle': 'chainlink',
            'reasoning': 'Test reasoning',
            'confidence_score': 0.95,
            'data_type': 'price'
        }
        
        with patch.object(api_client.oracle, 'route_question', return_value=AsyncMock()) as mock_route:
            mock_route.return_value.can_resolve = True
            mock_route.return_value.selected_oracle = OracleProvider.CHAINLINK
            mock_route.return_value.reasoning = 'Test reasoning'
            mock_route.return_value.confidence_score = 0.95
            
            result = await api_client.route_question("Will BTC hit $100k?")
            
            assert result.can_resolve is True
            assert result.selected_oracle == OracleProvider.CHAINLINK
            assert result.reasoning == 'Test reasoning'
            assert result.confidence_score == 0.95
    
    @pytest.mark.asyncio
    async def test_get_price_specific_provider(self, api_client):
        """Test getting price from specific provider"""
        mock_price = MagicMock()
        mock_price.price = "50000.00"
        mock_price.timestamp = "2024-01-01T00:00:00Z"
        
        with patch.object(api_client.oracle, 'get_chainlink_price', return_value=mock_price):
            result = await api_client.get_price("BTC/USD", provider=OracleProvider.CHAINLINK)
            
            assert result.price == "50000.00"
            assert result.timestamp == "2024-01-01T00:00:00Z"
    
    @pytest.mark.asyncio
    async def test_get_price_aggregated(self, api_client):
        """Test getting aggregated price"""
        mock_price = MagicMock()
        mock_price.aggregated_price = "50000.00"
        mock_price.providers = ['chainlink', 'pyth']
        mock_price.confidence = 0.95
        
        with patch.object(api_client.oracle, 'get_aggregated_price', return_value=mock_price):
            result = await api_client.get_price("BTC/USD")
            
            assert result.aggregated_price == "50000.00"
            assert 'chainlink' in result.providers
            assert result.confidence == 0.95
    
    @pytest.mark.asyncio
    async def test_create_prediction_market(self, api_client):
        """Test creating a prediction market"""
        mock_response = {
            'poll_id': 'btc-100k-2024',
            'question': 'Will BTC hit $100k in 2024?',
            'oracle_provider': 'chainlink',
            'status': 'active'
        }
        
        with patch.object(api_client.polls, 'create_oracle_poll', return_value=mock_response):
            result = await api_client.create_prediction_market(
                question="Will BTC hit $100k in 2024?",
                poll_id="btc-100k-2024"
            )
            
            assert result['poll_id'] == 'btc-100k-2024'
            assert result['oracle_provider'] == 'chainlink'
            assert result['status'] == 'active'
    
    @pytest.mark.asyncio
    async def test_analyze_tweet(self, api_client):
        """Test tweet analysis"""
        mock_analysis = {
            'has_prediction': True,
            'suggested_question': 'Will Tesla stock hit $300 by Q2 2024?',
            'category': 'stocks',
            'confidence': 0.85
        }
        
        with patch.object(api_client.twitter, 'analyze_tweet', return_value=mock_analysis):
            result = await api_client.analyze_tweet(
                "I predict Tesla stock will hit $300 by Q2 2024",
                author="@elonmusk"
            )
            
            assert result['has_prediction'] is True
            assert 'Tesla' in result['suggested_question']
            assert result['category'] == 'stocks'
    
    @pytest.mark.asyncio
    async def test_create_market_from_tweet(self, api_client):
        """Test creating market from tweet"""
        mock_analysis = {
            'suggested_question': 'Will Tesla stock hit $300 by Q2 2024?',
            'category': 'stocks'
        }
        
        mock_market = {
            'poll_id': 'tesla-300-q2-2024',
            'question': 'Will Tesla stock hit $300 by Q2 2024?',
            'status': 'active'
        }
        
        with patch.object(api_client.twitter, 'analyze_tweet', return_value=mock_analysis), \
             patch.object(api_client, 'create_prediction_market', return_value=mock_market):
            
            result = await api_client.create_market_from_tweet(
                tweet_text="I predict Tesla stock will hit $300 by Q2 2024",
                poll_id="tesla-300-q2-2024"
            )
            
            assert result['poll_id'] == 'tesla-300-q2-2024'
            assert 'Tesla' in result['question']
    
    @pytest.mark.asyncio
    async def test_health_check(self, api_client):
        """Test system health check"""
        mock_health = {
            'chainlink': {'status': 'healthy'},
            'pyth': {'status': 'healthy'}
        }
        
        with patch.object(api_client, 'get_oracle_health', return_value=mock_health):
            result = await api_client.health_check()
            
            assert result['status'] == 'healthy'
            assert 'oracle_providers' in result
            assert result['oracle_providers']['chainlink']['status'] == 'healthy'
    
    @pytest.mark.asyncio
    async def test_get_supported_assets(self, api_client):
        """Test getting supported assets"""
        mock_capabilities = {
            'chainlink': {
                'price': ['BTC/USD', 'ETH/USD', 'LINK/USD']
            },
            'pyth': {
                'price': ['BTC/USD', 'ETH/USD', 'SOL/USD']
            }
        }
        
        with patch.object(api_client, 'get_oracle_capabilities', return_value=mock_capabilities):
            # Test all assets
            assets = await api_client.get_supported_assets()
            assert 'BTC/USD' in assets
            assert 'ETH/USD' in assets
            assert 'SOL/USD' in assets
            assert 'LINK/USD' in assets
            
            # Test specific provider
            chainlink_assets = await api_client.get_supported_assets(OracleProvider.CHAINLINK)
            assert 'BTC/USD' in chainlink_assets
            assert 'LINK/USD' in chainlink_assets
            assert 'SOL/USD' not in chainlink_assets
    
    @pytest.mark.asyncio
    async def test_batch_price_feeds(self, api_client):
        """Test batch price operations"""
        mock_prices = [
            MagicMock(price="50000"),
            MagicMock(price="3000"),
            None  # Failed request
        ]
        
        with patch.object(api_client, 'get_price', side_effect=mock_prices):
            results = await api_client.batch_price_feeds(
                ['BTC/USD', 'ETH/USD', 'INVALID/USD']
            )
            
            assert len(results) == 3
            assert results[0] is not None
            assert results[1] is not None
            assert results[2] is None
    
    def test_config_update(self, api_client):
        """Test configuration updates"""
        api_client.update_config(
            api_key="new-api-key",
            timeout_seconds=60
        )
        
        assert api_client.config.api_key == "new-api-key"
        assert api_client.config.timeout_seconds == 60
    
    def test_metrics(self, api_client):
        """Test metrics collection"""
        # Initially no metrics
        metrics = api_client.get_metrics()
        assert isinstance(metrics, dict)
        
        # Clear metrics
        api_client.clear_metrics()
        
        # Should still return dict (empty or default)
        metrics_after_clear = api_client.get_metrics()
        assert isinstance(metrics_after_clear, dict)


@pytest.mark.asyncio
async def test_api_error_handling():
    """Test API error handling"""
    config = OracleConfig(api_key="invalid-key")
    
    async with OpenOracleAPI(config) as api:
        # Test should handle auth errors gracefully
        with patch.object(api.client, 'post', side_effect=AuthenticationError("Invalid key")):
            with pytest.raises(AuthenticationError):
                await api.route_question("Test question")


@pytest.mark.asyncio 
async def test_network_error_handling():
    """Test network error handling"""
    config = OracleConfig()
    
    async with OpenOracleAPI(config) as api:
        with patch.object(api.client, 'get', side_effect=NetworkError("Connection failed")):
            with pytest.raises(NetworkError):
                await api.get_oracle_health()