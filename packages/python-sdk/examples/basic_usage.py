"""
Basic Usage Examples for OpenOracle Python SDK
"""

import asyncio
import os
from decimal import Decimal

from openoracle import (
    OpenOracleAPI,
    OracleConfig,
    OracleProvider,
    DataCategory
)


async def basic_routing_example():
    """Example of basic oracle routing"""
    print("=== Basic Oracle Routing Example ===")
    
    # Initialize API client with environment variables
    async with OpenOracleAPI() as api:
        # Route a question to the best oracle
        question = "Will Bitcoin exceed $100,000 by the end of 2024?"
        
        routing = await api.route_question(
            question=question,
            category_hint=DataCategory.PRICE,
            max_cost_usd=Decimal("5.00"),
            max_latency_ms=30000
        )
        
        print(f"Question: {question}")
        print(f"Can Resolve: {routing.can_resolve}")
        
        if routing.can_resolve:
            print(f"Selected Oracle: {routing.selected_oracle}")
            print(f"Confidence Score: {routing.confidence_score:.2f}")
            print(f"Reasoning: {routing.reasoning}")
            if routing.estimated_cost_usd:
                print(f"Estimated Cost: ${routing.estimated_cost_usd}")
            if routing.estimated_latency_ms:
                print(f"Estimated Latency: {routing.estimated_latency_ms}ms")
        else:
            print(f"Cannot resolve: {routing.reasoning}")


async def price_feeds_example():
    """Example of getting price feeds"""
    print("\n=== Price Feeds Example ===")
    
    async with OpenOracleAPI() as api:
        # Get price from specific provider
        chainlink_btc = await api.get_price("BTC/USD", provider=OracleProvider.CHAINLINK)
        print(f"Chainlink BTC Price: ${chainlink_btc.price}")
        
        # Get aggregated price from multiple providers
        eth_price = await api.get_price("ETH/USD")
        print(f"Aggregated ETH Price: ${eth_price.aggregated_price}")
        print(f"Providers Used: {', '.join(eth_price.providers)}")
        print(f"Confidence: {eth_price.confidence:.2f}")
        
        # Batch price requests
        assets = ["BTC/USD", "ETH/USD", "LINK/USD"]
        prices = await api.batch_price_feeds(assets)
        
        print("\nBatch Price Results:")
        for asset, price in zip(assets, prices):
            if price:
                price_value = price.price if hasattr(price, 'price') else price.aggregated_price
                print(f"  {asset}: ${price_value}")
            else:
                print(f"  {asset}: Failed to fetch")


async def prediction_market_example():
    """Example of creating prediction markets"""
    print("\n=== Prediction Market Example ===")
    
    async with OpenOracleAPI() as api:
        # Create a prediction market
        question = "Will Tesla stock price exceed $300 by Q2 2024?"
        poll_id = f"tesla-300-q2-2024-{int(asyncio.get_event_loop().time())}"
        
        market = await api.create_prediction_market(
            question=question,
            poll_id=poll_id,
            auto_resolve=True,
            category_hint=DataCategory.STOCKS
        )
        
        print(f"Created Market: {market['poll_id']}")
        print(f"Question: {market.get('question', question)}")
        print(f"Oracle Provider: {market.get('oracle_provider', 'TBD')}")
        print(f"Auto Resolve: {market.get('auto_resolve', True)}")
        
        # Get market details
        market_details = await api.get_market(poll_id)
        print(f"Market Status: {market_details.get('status', 'unknown')}")


async def twitter_integration_example():
    """Example of Twitter integration"""
    print("\n=== Twitter Integration Example ===")
    
    async with OpenOracleAPI() as api:
        # Analyze a tweet for prediction potential
        tweet_text = "I predict that Apple will reach a $4 trillion market cap by the end of 2024 🚀"
        
        analysis = await api.analyze_tweet(
            tweet_text=tweet_text,
            author="@tim_cook"  # Example author
        )
        
        print(f"Tweet: {tweet_text}")
        print(f"Has Prediction: {analysis.get('has_prediction', False)}")
        print(f"Category: {analysis.get('category', 'unknown')}")
        print(f"Confidence: {analysis.get('confidence', 0):.2f}")
        
        if analysis.get('suggested_question'):
            print(f"Suggested Question: {analysis['suggested_question']}")
            
            # Create market from tweet
            poll_id = f"apple-4t-2024-{int(asyncio.get_event_loop().time())}"
            
            market = await api.create_market_from_tweet(
                tweet_text=tweet_text,
                poll_id=poll_id,
                author="@tim_cook"
            )
            
            print(f"Created Market from Tweet: {market['poll_id']}")


async def oracle_health_example():
    """Example of checking oracle health"""
    print("\n=== Oracle Health Check Example ===")
    
    async with OpenOracleAPI() as api:
        # Check system health
        health = await api.health_check()
        
        print(f"Overall Status: {health['status']}")
        
        if 'oracle_providers' in health:
            print("\nOracle Provider Status:")
            for provider, status in health['oracle_providers'].items():
                provider_status = status.get('status', 'unknown')
                last_update = status.get('last_update', 'N/A')
                print(f"  {provider}: {provider_status} (last update: {last_update})")
        
        # Get supported assets and sports
        assets = await api.get_supported_assets()
        print(f"\nSupported Assets: {len(assets)} total")
        print(f"Sample assets: {', '.join(assets[:10])}")
        
        sports = await api.get_supported_sports()
        if sports:
            print(f"Supported Sports: {', '.join(sports)}")


async def configuration_example():
    """Example of configuration management"""
    print("\n=== Configuration Example ===")
    
    # Create custom configuration
    config = OracleConfig(
        api_key=os.getenv('OPENORACLE_API_KEY', 'demo-key'),
        base_url=os.getenv('OPENORACLE_BASE_URL', 'https://api.openoracle.ai'),
        openrouter_api_key=os.getenv('OPENROUTER_API_KEY'),
        enable_ai_routing=True,
        timeout_seconds=60
    )
    
    print(f"Base URL: {config.base_url}")
    print(f"AI Routing Enabled: {config.enable_ai_routing}")
    print(f"Timeout: {config.timeout_seconds}s")
    
    # Validate configuration
    issues = config.validate()
    if issues:
        print(f"Configuration Issues: {', '.join(issues)}")
    else:
        print("Configuration is valid ✓")
    
    # Use custom configuration
    async with OpenOracleAPI(config) as api:
        # Test with custom config
        try:
            health = await api.health_check()
            print(f"API Connection: Success ✓")
        except Exception as e:
            print(f"API Connection: Failed - {e}")


async def error_handling_example():
    """Example of error handling"""
    print("\n=== Error Handling Example ===")
    
    from openoracle.core.exceptions import (
        RoutingError,
        ProviderError,
        ValidationError,
        NetworkError
    )
    
    async with OpenOracleAPI() as api:
        try:
            # Try to route an invalid question
            routing = await api.route_question("")  # Empty question
            
        except ValidationError as e:
            print(f"Validation Error: {e.message}")
            print(f"Field: {e.field_name}")
            
        except RoutingError as e:
            print(f"Routing Error: {e.message}")
            print(f"Available Providers: {e.available_providers}")
            
        except ProviderError as e:
            print(f"Provider Error: {e.message}")
            print(f"Provider: {e.provider_name}")
            
        except NetworkError as e:
            print(f"Network Error: {e.message}")
            print(f"Endpoint: {e.endpoint}")
            
        except Exception as e:
            print(f"Unexpected Error: {e}")


async def main():
    """Run all examples"""
    print("OpenOracle Python SDK - Basic Usage Examples")
    print("=" * 50)
    
    # Check for required environment variables
    api_key = os.getenv('OPENORACLE_API_KEY')
    if not api_key:
        print("⚠️  OPENORACLE_API_KEY not set. Some examples may fail.")
        print("   Set your API key with: export OPENORACLE_API_KEY='your-key'")
    
    try:
        await basic_routing_example()
        await price_feeds_example()
        await prediction_market_example()
        await twitter_integration_example()
        await oracle_health_example()
        await configuration_example()
        await error_handling_example()
        
        print("\n=== Examples completed successfully! ===")
        
    except KeyboardInterrupt:
        print("\n⚠️  Examples interrupted by user")
        
    except Exception as e:
        print(f"\n❌ Example failed with error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    # Run the examples
    asyncio.run(main())