# OpenOracle Node.js SDK

Intelligent Oracle Routing for Prediction Markets

[![npm version](https://badge.fury.io/js/openoracle.svg)](https://badge.fury.io/js/openoracle)
[![Node.js](https://img.shields.io/node/v/openoracle.svg)](https://www.npmjs.com/package/openoracle)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Overview

The OpenOracle Node.js SDK provides a comprehensive interface for building prediction markets with intelligent oracle selection and data verification. It automatically routes questions to the most appropriate oracle provider based on AI analysis, supports multiple blockchain networks, and includes built-in Twitter integration for social media prediction markets.

## Key Features

- 🤖 **AI-Powered Oracle Routing** - Automatically selects the best oracle for any question
- 🔗 **Multi-Oracle Support** - Chainlink, Pyth, UMA, Band Protocol, API3, and more
- 🐦 **Twitter Integration** - Create prediction markets from tweets
- ⛓️ **Cross-Chain Compatibility** - Ethereum, Polygon, Flow EVM, Arbitrum
- 🛡️ **Type Safety** - Full TypeScript support with comprehensive type definitions
- ⚡ **Async/Await Support** - Modern Promise-based API
- 🔄 **Automatic Retries** - Robust error handling and retry logic
- 📊 **Real-time Data** - WebSocket and MQTT connections for live updates
- 🖥️ **CLI Tool** - Command-line interface for quick operations

## Installation

```bash
npm install openoracle
```

For CLI usage:
```bash
npm install -g openoracle
```

## Quick Start

### Basic Usage

```typescript
import { OpenOracleAPI, OracleConfig } from 'openoracle';

async function main() {
  // Initialize the API client
  const config = new OracleConfig({
    apiKey: process.env.OPENORACLE_API_KEY,
    baseUrl: 'https://api.openoracle.ai'
  });
  
  const api = new OpenOracleAPI(config);
  
  try {
    // Route a question to the best oracle
    const routing = await api.routeQuestion(
      "Will BTC exceed $100k by end of 2024?"
    );
    
    console.log(`Selected Oracle: ${routing.selectedOracle}`);
    console.log(`Confidence: ${routing.confidenceScore}`);
    console.log(`Reasoning: ${routing.reasoning}`);
    
    // Get current BTC price
    const price = await api.getPrice("BTC/USD");
    console.log(`Current BTC Price: $${price.price}`);
    
    // Create a prediction market
    const market = await api.createPredictionMarket({
      question: "Will BTC exceed $100k by end of 2024?",
      pollId: "btc-100k-2024"
    });
    
    console.log(`Market created: ${market.pollId}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await api.close();
  }
}

main();
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

```typescript
import { OracleConfig, OpenOracleAPI } from 'openoracle-sdk';

const config = new OracleConfig({
  apiKey: "your-api-key",
  baseUrl: "https://api.openoracle.ai",
  openrouterApiKey: "your-openrouter-key",
  enableAiRouting: true,
  timeout: 30000,
  retries: 3
});

const api = new OpenOracleAPI(config);
```

### Twitter Integration

```typescript
import { OpenOracleAPI } from 'openoracle-sdk';

const api = new OpenOracleAPI();

// Analyze a tweet for prediction potential
const analysis = await api.analyzeTweet({
  tweetText: "I predict Tesla stock will hit $300 by Q2 2024",
  author: "@elonmusk"
});

console.log(`Prediction detected: ${analysis.hasPrediction}`);
console.log(`Suggested question: ${analysis.suggestedQuestion}`);

// Create market directly from tweet
const market = await api.createMarketFromTweet({
  tweetText: "I predict Tesla stock will hit $300 by Q2 2024",
  pollId: "tesla-300-q2-2024",
  author: "@elonmusk"
});
```

### Oracle Provider Usage

```typescript
// Get price from specific oracle
const chainlinkPrice = await api.getPrice("ETH/USD", { provider: "chainlink" });
const pythPrice = await api.getPrice("BTC/USD", { provider: "pyth" });

// Get aggregated price from multiple oracles
const aggregatedPrice = await api.getPrice("ETH/USD"); // Uses all available oracles

// Check oracle health
const health = await api.getOracleHealth();
console.log(`Chainlink status: ${health.chainlink.status}`);

// Get supported assets
const assets = await api.getSupportedAssets();
const sports = await api.getSupportedSports();
```

### Real-time Data with WebSockets

```typescript
import { OpenOracleAPI } from 'openoracle-sdk';

const api = new OpenOracleAPI();

// Subscribe to price updates
await api.subscribeToPrice("BTC/USD", (priceData) => {
  console.log(`New BTC price: $${priceData.price}`);
  console.log(`Change: ${priceData.change24h}%`);
});

// Subscribe to multiple assets
await api.subscribeToPrices(["BTC/USD", "ETH/USD", "SOL/USD"], (priceData) => {
  console.log(`${priceData.symbol}: $${priceData.price}`);
});
```

### CLI Usage

The SDK includes a powerful command-line interface:

```bash
# Route a question
openoracle route "Will BTC hit $100k in 2024?"

# Get current price
openoracle price BTC/USD

# Analyze a tweet
openoracle tweet "I predict Tesla will hit $300 by Q2" --author @elonmusk

# Check oracle health
openoracle health

# Create a prediction market
openoracle create-market "Will ETH hit $10k?" --poll-id eth-10k-2024
```

## Advanced Features

### Batch Operations

```typescript
// Batch route multiple questions
const questions = [
  "Will BTC hit $100k in 2024?",
  "Will ETH hit $10k in 2024?",
  "Will DOGE hit $1 in 2024?"
];

const routings = await api.batchRouteQuestions(questions);
const prices = await api.batchPriceFeeds(["BTC/USD", "ETH/USD", "DOGE/USD"]);
```

### Custom Oracle Integration

```typescript
import { BaseOracleProvider, OracleProvider } from 'openoracle-sdk';

class CustomOracle extends BaseOracleProvider {
  async getPriceFeed(symbol: string): Promise<PriceFeed> {
    // Your custom implementation
    return {
      symbol,
      price: 50000,
      timestamp: Date.now(),
      source: 'custom-oracle'
    };
  }
}

// Register custom oracle
api.registerProvider('custom', new CustomOracle());
```

### Error Handling

```typescript
import { 
  RoutingError, 
  ProviderError, 
  ValidationError, 
  NetworkError 
} from 'openoracle-sdk';

try {
  const routing = await api.routeQuestion("Invalid question");
} catch (error) {
  if (error instanceof RoutingError) {
    console.error(`Routing failed: ${error.message}`);
    console.error(`Available providers: ${error.availableProviders}`);
  } else if (error instanceof ProviderError) {
    console.error(`Provider ${error.providerName} failed: ${error.providerError}`);
  } else if (error instanceof ValidationError) {
    console.error(`Validation failed: ${error.fieldName} = ${error.fieldValue}`);
  } else if (error instanceof NetworkError) {
    console.error(`Network error: ${error.message}`);
  }
}
```

## Core Components

### OracleRouter
The main routing engine that selects optimal oracles:

```typescript
import { OracleRouter, OracleConfig } from 'openoracle-sdk';

const config = OracleConfig.fromEnv();
const router = new OracleRouter(config);

const routing = await router.routePollQuestion(
  "Will the Fed raise rates in March?",
  { categoryHint: "economic" }
);
```

### Oracle Providers
Individual oracle provider interfaces:

```typescript
import { ChainlinkProvider, PythProvider } from 'openoracle-sdk/providers';

// Direct provider usage
const chainlink = new ChainlinkProvider({ rpcUrl: "https://eth.llamarpc.com" });
const priceFeed = await chainlink.getPriceFeed("ETH/USD");

const pyth = new PythProvider();
const pythPrice = await pyth.getPriceFeed("BTC/USD");
```

### Type Definitions
Comprehensive TypeScript types:

```typescript
import { 
  OracleRoutingRequest, 
  OracleProvider, 
  PriceFeed,
  PredictionMarket 
} from 'openoracle-sdk/types';

const request: OracleRoutingRequest = {
  question: "Will BTC hit $100k?",
  categoryHint: "price",
  maxCostUsd: 10.0,
  preferredProviders: [OracleProvider.CHAINLINK, OracleProvider.PYTH]
};
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

## Testing

Run the test suite:

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Type checking
npm run type-check

# Linting
npm run lint
```

## Examples

Complete examples are available in the repository:

- **basic-usage.js** - Getting started examples
- **twitter-integration.js** - Social media prediction markets  
- **price-monitoring.js** - Real-time price feeds with WebSockets
- **custom-oracles.js** - Building custom oracle integrations
- **batch-operations.js** - Efficient batch processing
- **cli-examples.sh** - Command-line interface examples

## API Reference

Complete API documentation is available at [docs.openoracle.ai](https://docs.openoracle.ai)

### Main Classes

- `OpenOracleAPI` - Main API client
- `OracleRouter` - Core routing engine  
- `TwitterAnalyzer` - Social media integration
- `OracleConfig` - Configuration management
- `WebSocketClient` - Real-time data streaming

### Key Methods

- `routeQuestion()` - Route questions to optimal oracles
- `getPrice()` - Get asset prices
- `createPredictionMarket()` - Create new markets
- `analyzeTweet()` - Analyze social media content
- `getOracleHealth()` - Check oracle status
- `subscribeToPrice()` - Real-time price updates

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
git clone https://github.com/openoracle/node-sdk
cd node-sdk

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Start development mode (with hot reload)
npm run dev
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
- [ ] React Native SDK compatibility
- [ ] Telegram/Discord bot integration
- [ ] Governance token integration
- [ ] Cross-chain message passing

---

**Built with ❤️ by the OpenOracle Team**