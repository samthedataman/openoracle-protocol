# OpenOracle Python SDK

Intelligent Oracle Routing for Prediction Markets

[![PyPI version](https://badge.fury.io/py/openoracle.svg)](https://badge.fury.io/py/openoracle)
[![Python](https://img.shields.io/pypi/pyversions/openoracle.svg)](https://pypi.org/project/openoracle/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Overview

The OpenOracle Python SDK provides a comprehensive interface for building prediction markets with intelligent oracle selection and data verification. It automatically routes questions to the most appropriate oracle provider based on AI analysis, supports multiple blockchain networks, and includes built-in Twitter integration for social media prediction markets.

## Key Features

- 🤖 **AI-Powered Oracle Routing** - Automatically selects the best oracle for any question
- 🔗 **Multi-Oracle Support** - Chainlink, Pyth, UMA, Band Protocol, API3, and more
- 🐦 **Twitter Integration** - Create prediction markets from tweets
- ⛓️ **Cross-Chain Compatibility** - Ethereum, Polygon, Flow EVM, Arbitrum
- 🛡️ **Type Safety** - Full Pydantic validation for all data models
- ⚡ **Async/Await Support** - High-performance async operations
- 🔄 **Automatic Retries** - Robust error handling and retry logic
- 📊 **Real-time Data** - Live price feeds and market updates

## Installation

```bash
pip install openoracle
```

For development dependencies:
```bash
pip install openoracle[dev]
```

For all optional features:
```bash
pip install openoracle[all]
```

## Quick Start

### Basic Usage

```python
import asyncio
from openoracle import OpenOracleAPI

async def main():
    # Initialize the API client
    async with OpenOracleAPI() as api:
        # Route a question to the best oracle
        routing = await api.route_question(
            "Will BTC exceed $100k by end of 2024?"
        )
        
        print(f"Selected Oracle: {routing.selected_oracle}")
        print(f"Confidence: {routing.confidence_score}")
        print(f"Reasoning: {routing.reasoning}")
        
        # Get current BTC price
        price = await api.get_price("BTC/USD")
        print(f"Current BTC Price: ${price.price}")
        
        # Create a prediction market
        market = await api.create_prediction_market(
            question="Will BTC exceed $100k by end of 2024?",
            poll_id="btc-100k-2024"
        )
        print(f"Market created: {market['poll_id']}")

asyncio.run(main())
```

### Configuration

Configure the SDK using environment variables:

```bash
# Core API settings
export OPENORACLE_API_KEY="your-api-key"
export OPENORACLE_BASE_URL="https://api.openoracle.ai"

# AI routing (optional)
export OPENROUTER_API_KEY="your-openrouter-key"
export OPENAI_API_KEY="your-openai-key"

# Oracle provider settings
export CHAINLINK_API_KEY="your-chainlink-key"
export PYTH_ENDPOINT="https://hermes.pyth.network"

# Blockchain RPCs
export ETH_RPC_URL="https://eth.llamarpc.com"
export POLYGON_RPC_URL="https://polygon.llamarpc.com"
```

Or use a configuration object:

```python
from openoracle import OracleConfig, OpenOracleAPI

config = OracleConfig(
    api_key="your-api-key",
    base_url="https://api.openoracle.ai",
    openrouter_api_key="your-openrouter-key",
    enable_ai_routing=True
)

async with OpenOracleAPI(config) as api:
    # Your code here
    pass
```

### Twitter Integration

```python
from openoracle import OpenOracleAPI

async with OpenOracleAPI() as api:
    # Analyze a tweet for prediction potential
    analysis = await api.analyze_tweet(
        tweet_text="I predict Tesla stock will hit $300 by Q2 2024",
        author="@elonmusk"
    )
    
    print(f"Prediction detected: {analysis['has_prediction']}")
    print(f"Suggested question: {analysis['suggested_question']}")
    
    # Create market directly from tweet
    market = await api.create_market_from_tweet(
        tweet_text="I predict Tesla stock will hit $300 by Q2 2024",
        poll_id="tesla-300-q2-2024",
        author="@elonmusk"
    )
```

### Oracle Provider Usage

```python
# Get price from specific oracle
chainlink_price = await api.get_price("ETH/USD", provider="chainlink")
pyth_price = await api.get_price("BTC/USD", provider="pyth")

# Get aggregated price from multiple oracles
aggregated_price = await api.get_price("ETH/USD")  # Uses all available oracles

# Check oracle health
health = await api.get_oracle_health()
print(f"Chainlink status: {health['chainlink']['status']}")

# Get supported assets
assets = await api.get_supported_assets()
sports = await api.get_supported_sports()
```

### Advanced Features

```python
# Batch operations
questions = [
    "Will BTC hit $100k in 2024?",
    "Will ETH hit $10k in 2024?",
    "Will DOGE hit $1 in 2024?"
]

routings = await api.batch_route_questions(questions)
prices = await api.batch_price_feeds(["BTC/USD", "ETH/USD", "DOGE/USD"])

# Real-time price monitoring
async def price_callback(price_data):
    print(f"New price: {price_data.price}")

# This would use WebSocket connections in a real implementation
await api.subscribe_to_prices(["BTC/USD"], callback=price_callback)
```

## Core Components

### OracleRouter
The main routing engine that selects optimal oracles:

```python
from openoracle import OracleRouter, OracleConfig

config = OracleConfig.from_env()
router = OracleRouter(config)

routing = await router.route_poll_question(
    "Will the Fed raise rates in March?",
    category_hint="economic"
)
```

### Oracle Providers
Individual oracle provider interfaces:

```python
from openoracle.providers import ChainlinkProvider, PythProvider

# Direct provider usage
chainlink = ChainlinkProvider(rpc_url="https://eth.llamarpc.com")
price_feed = await chainlink.get_price_feed("ETH/USD")

pyth = PythProvider()
pyth_price = await pyth.get_price_feed("BTC/USD")
```

### Schema Validation
Type-safe data models using Pydantic:

```python
from openoracle.schemas import OracleRoutingRequest, OracleProvider

request = OracleRoutingRequest(
    question="Will BTC hit $100k?",
    category_hint="price",
    max_cost_usd=10.0,
    preferred_providers=[OracleProvider.CHAINLINK, OracleProvider.PYTH]
)
```

## Supported Oracle Providers

| Provider | Price Feeds | Sports | Weather | Events | Custom |
|----------|-------------|---------|---------|---------|---------|
| **Chainlink** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Pyth Network** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **UMA Protocol** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Band Protocol** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **API3** | ✅ | ❌ | ✅ | ❌ | ✅ |

## Supported Blockchains

- Ethereum Mainnet
- Polygon
- Flow EVM
- Arbitrum
- Avalanche
- Base
- Optimism

## Error Handling

The SDK provides comprehensive error handling:

```python
from openoracle.exceptions import (
    RoutingError,
    ProviderError,
    ValidationError,
    NetworkError
)

try:
    routing = await api.route_question("Invalid question")
except RoutingError as e:
    print(f"Routing failed: {e.message}")
    print(f"Available providers: {e.available_providers}")
except ProviderError as e:
    print(f"Provider {e.provider_name} failed: {e.provider_error}")
except ValidationError as e:
    print(f"Validation failed: {e.field_name} = {e.field_value}")
```

## Testing

Run the test suite:

```bash
# Install dev dependencies
pip install -e .[dev]

# Run tests
pytest

# Run tests with coverage
pytest --cov=openoracle

# Run specific tests
pytest tests/test_routing.py
```

## Examples

See the `/examples` directory for complete examples:

- **basic_usage.py** - Getting started examples
- **twitter_integration.py** - Social media prediction markets  
- **price_monitoring.py** - Real-time price feeds
- **custom_oracles.py** - Building custom oracle integrations
- **batch_operations.py** - Efficient batch processing

## API Reference

Complete API documentation is available at [docs.openoracle.ai](https://docs.openoracle.ai)

### Main Classes

- `OpenOracleAPI` - Main API client
- `OracleRouter` - Core routing engine
- `TwitterAnalyzer` - Social media integration
- `OracleConfig` - Configuration management

### Key Methods

- `route_question()` - Route questions to optimal oracles
- `get_price()` - Get asset prices
- `create_prediction_market()` - Create new markets
- `analyze_tweet()` - Analyze social media content
- `get_oracle_health()` - Check oracle status

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
git clone https://github.com/openoracle/python-sdk
cd python-sdk

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install in development mode
pip install -e .[dev]

# Install pre-commit hooks
pre-commit install

# Run tests
pytest
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: [docs.openoracle.ai](https://docs.openoracle.ai)
- **Discord**: [discord.gg/openoracle](https://discord.gg/openoracle) 
- **Twitter**: [@OpenOracleHQ](https://twitter.com/OpenOracleHQ)
- **Email**: [team@openoracle.ai](mailto:team@openoracle.ai)

## Roadmap

- [ ] Additional oracle providers (DIA, Tellor, Supra)
- [ ] GraphQL API support
- [ ] Advanced analytics and insights
- [ ] Mobile SDK (React Native)
- [ ] Telegram/Discord bot integration
- [ ] Governance token integration
- [ ] Cross-chain message passing

---

**Built with ❤️ by the OpenOracle Team**