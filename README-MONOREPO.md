# OpenOracle SDK Monorepo 🔮

[![PyPI](https://img.shields.io/pypi/v/openoracle)](https://pypi.org/project/openoracle/)
[![npm](https://img.shields.io/npm/v/openoracle)](https://www.npmjs.com/package/openoracle)
[![npm React](https://img.shields.io/npm/v/openoracle-react)](https://www.npmjs.com/package/openoracle-react)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Intelligent Oracle Routing for Prediction Markets and Decentralized Applications**

OpenOracle is a comprehensive SDK suite that provides intelligent routing between multiple oracle providers, AI-powered data analysis, and seamless integration with prediction markets. Built for developers who need reliable, cost-effective, and intelligent oracle solutions.

## 🚀 Quick Start

### Python
```bash
pip install openoracle
```

### Node.js
```bash
npm install openoracle
```

### React
```bash
npm install openoracle-react
```

## 📦 SDK Overview

This monorepo contains three complementary SDKs:

| Package | Language | Description | Use Cases |
|---------|----------|-------------|-----------|
| [`openoracle`](./openoracle-sdk/) | Python | Core oracle routing with AI integration | Backend services, data analysis, ML pipelines |
| [`openoracle`](./node-sdk/) | Node.js/TypeScript | Enterprise-grade oracle client | Web APIs, serverless functions, microservices |
| [`openoracle-react`](./openoracle-react/) | React/TypeScript | Frontend oracle components with local LLM support | dApps, prediction markets, data dashboards |

## 🎯 Key Features

### 🧠 Intelligent Oracle Routing
- **AI-Powered Selection**: Automatically choose the best oracle provider for each query
- **Multi-Provider Support**: Chainlink, Pyth, UMA, Band Protocol, API3, and more
- **Fallback Mechanisms**: Automatic failover and redundancy
- **Cost Optimization**: Route to the most cost-effective provider

### 🌐 Comprehensive LLM Integration
- **Multiple Providers**: OpenAI, OpenRouter, Anthropic, Groq, Ollama
- **Free Tier Options**: Groq, OpenRouter free models, local LLMs
- **Local Inference**: WebLLM for browser-based AI (React SDK)
- **Structured Output**: JSON schema validation and type safety

### ⚡ Production-Ready Features
- **Caching & Rate Limiting**: Built-in Redis support and request throttling
- **Real-time Updates**: WebSocket and SSE support
- **Monitoring**: Comprehensive logging and performance metrics
- **Type Safety**: Full TypeScript support across all SDKs

### 📱 Frontend-First Design
- **React Hooks**: Pre-built hooks for common oracle operations
- **Responsive UI**: Mobile-optimized oracle data displays
- **Real-time Updates**: Live data feeds and prediction updates
- **Offline Support**: Local LLM fallbacks when network is unavailable

## 🔧 Architecture

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Frontend App      │    │   Backend API       │    │   Data Sources      │
│  (openoracle-react) │    │  (openoracle py/js) │    │   (oracle networks) │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
          │                          │                          │
          │   HTTP/WebSocket         │   Oracle Protocols       │
          └──────────────────────────┼──────────────────────────┘
                                     │
                  ┌─────────────────────┐
                  │   AI Router         │
                  │  - Provider Select  │
                  │  - Cost Optimize    │
                  │  - Quality Score    │
                  └─────────────────────┘
```

## 🛠 Installation & Setup

### Python SDK

```bash
# Install from PyPI
pip install openoracle

# Development setup
git clone https://github.com/openoracle/openoracle.git
cd openoracle/packages/openoracle-sdk
pip install -e .
```

**Quick Example:**
```python
from openoracle import OracleRouter, OracleConfig

# Initialize with API keys from environment
config = OracleConfig.from_env()
router = OracleRouter(config)

# Route a question to the best oracle
response = await router.route_question(
    "Will Bitcoin exceed $100,000 by December 31, 2024?"
)

print(f"Oracle: {response.provider}")
print(f"Answer: {response.answer}")
print(f"Confidence: {response.confidence}")
print(f"Sources: {response.sources}")
```

### Node.js SDK

```bash
# Install from npm
npm install openoracle

# Development setup
git clone https://github.com/openoracle/openoracle.git
cd openoracle/packages/node-sdk
npm install && npm run build
```

**Quick Example:**
```typescript
import { OracleRouter, OracleConfig } from 'openoracle'

const config = OracleConfig.fromEnv()
const router = new OracleRouter(config)

// Real-time price feed
const priceStream = router.subscribeToPriceFeed('BTC/USD', {
  providers: ['chainlink', 'pyth'],
  updateInterval: 1000
})

priceStream.on('price', (data) => {
  console.log(`BTC: $${data.price} (${data.provider})`)
})
```

### React SDK

```bash
# Install from npm
npm install openoracle-react

# Development setup
git clone https://github.com/openoracle/openoracle.git
cd openoracle/packages/openoracle-react
npm install && npm run build
```

**Quick Example:**
```tsx
import { useOracle, OracleProvider } from 'openoracle-react'

function App() {
  return (
    <OracleProvider config={{ 
      providers: ['openai', 'groq'], 
      fallbackToLocal: true 
    }}>
      <PredictionMarket />
    </OracleProvider>
  )
}

function PredictionMarket() {
  const { query, loading, error } = useOracle()
  
  const handlePredict = async () => {
    const result = await query({
      prompt: "Analyze this news for prediction market opportunities",
      context: newsArticle,
      schema: PredictionSchema
    })
    
    console.log('Prediction:', result.data)
  }
  
  return (
    <div>
      <button onClick={handlePredict} disabled={loading}>
        Generate Prediction
      </button>
      {error && <div>Error: {error.message}</div>}
    </div>
  )
}
```

## 🎮 Use Cases

### 📊 Prediction Markets
Build viral prediction markets like PolyPoll with AI-generated questions and real-time oracle data:

```python
from openoracle import TwitterAnalyzer, PredictionGenerator

analyzer = TwitterAnalyzer(config)
generator = PredictionGenerator(config)

# Analyze trending topics
trends = await analyzer.get_trending_topics()

# Generate prediction questions
for trend in trends:
    question = await generator.create_prediction(
        context=trend.content,
        perspectives=['optimistic', 'pessimistic'],
        time_horizon='7d'
    )
    print(f"Question: {question.text}")
    print(f"Expiry: {question.expiry_date}")
```

### 💹 DeFi Applications
Integrate real-time price feeds with automatic oracle selection:

```typescript
import { OracleRouter, PriceAggregator } from 'openoracle'

const aggregator = new PriceAggregator({
  assets: ['ETH/USD', 'BTC/USD', 'LINK/USD'],
  providers: ['chainlink', 'pyth', 'uma'],
  refreshRate: 5000
})

await aggregator.start()

aggregator.on('priceUpdate', ({ asset, price, provider }) => {
  console.log(`${asset}: $${price} from ${provider}`)
})
```

### 🤖 AI-Powered Analytics
Combine multiple LLM providers for robust analysis:

```tsx
import { useMultiLLM } from 'openoracle-react'

function AIAnalysis({ data }) {
  const { analyze, results, loading } = useMultiLLM({
    providers: ['openai', 'anthropic', 'groq'],
    fallback: 'local-llm'
  })
  
  const handleAnalyze = () => {
    analyze({
      prompt: "Analyze market sentiment",
      data,
      consensus: true // Get consensus from multiple providers
    })
  }
  
  return (
    <div>
      <button onClick={handleAnalyze}>Analyze with AI</button>
      {results && <div>Consensus: {results.consensus}</div>}
    </div>
  )
}
```

## 🌟 Advanced Features

### 📝 Custom Oracle Providers
Extend OpenOracle with your own oracle implementations:

```python
from openoracle.providers import BaseOracleProvider

class MyCustomOracle(BaseOracleProvider):
    async def query(self, question: str) -> OracleResponse:
        # Your custom logic here
        return OracleResponse(
            answer="Custom response",
            confidence=0.95,
            provider="my-oracle"
        )

# Register and use
router.register_provider('my-oracle', MyCustomOracle)
```

### 🔄 Real-time Subscriptions
Subscribe to live data feeds:

```typescript
import { OracleWebSocket } from 'openoracle'

const ws = new OracleWebSocket({
  endpoint: 'wss://api.openoracle.ai/v1/ws',
  auth: { apiKey: process.env.OPENORACLE_API_KEY }
})

// Subscribe to multiple feeds
ws.subscribe(['prices', 'predictions', 'market-events'])

ws.on('prices', (data) => {
  updatePriceChart(data)
})

ws.on('predictions', (data) => {
  updatePredictionMarket(data)
})
```

### 🎯 Smart Routing Strategies
Configure advanced routing logic:

```python
from openoracle import RoutingStrategy

router.configure_routing(RoutingStrategy(
    primary_strategy='lowest_cost',
    fallback_strategy='highest_reliability',
    max_latency_ms=500,
    min_confidence=0.8,
    provider_weights={
        'chainlink': 0.4,
        'pyth': 0.3,
        'uma': 0.3
    }
))
```

## 📊 Monitoring & Analytics

### Built-in Metrics
```python
from openoracle.monitoring import OracleMetrics

metrics = OracleMetrics(config)

# Get provider performance
stats = await metrics.get_provider_stats('chainlink')
print(f"Uptime: {stats.uptime}%")
print(f"Avg Latency: {stats.avg_latency}ms")
print(f"Cost per Query: ${stats.cost_per_query}")

# Export to Prometheus/Grafana
metrics.export_prometheus()
```

### Custom Dashboards
```tsx
import { OracleMetricsDashboard } from 'openoracle-react'

function MonitoringPage() {
  return (
    <OracleMetricsDashboard 
      providers={['chainlink', 'pyth']}
      timeRange="24h"
      metrics={['latency', 'cost', 'reliability']}
      autoRefresh={30000}
    />
  )
}
```

## 🔐 Security & Best Practices

### API Key Management
```bash
# Environment variables
export OPENORACLE_CHAINLINK_API_KEY="your-key"
export OPENORACLE_PYTH_API_KEY="your-key"
export OPENORACLE_OPENAI_API_KEY="your-key"

# Or use .env files
cp .env.example .env
# Edit .env with your keys
```

### Rate Limiting
```python
from openoracle import RateLimiter

router = OracleRouter(config, rate_limiter=RateLimiter(
    requests_per_minute=100,
    burst_limit=10,
    provider_limits={
        'chainlink': 200,
        'openai': 50
    }
))
```

### Data Validation
```typescript
import { z } from 'zod'
import { validateSchema } from 'openoracle'

const PriceSchema = z.object({
  price: z.number().positive(),
  timestamp: z.number(),
  provider: z.string()
})

const result = await router.queryWithValidation(
  "Get BTC price",
  PriceSchema
)
// TypeScript knows result is validated
```

## 🚀 Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install openoracle
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: openoracle-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: openoracle-app
  template:
    spec:
      containers:
      - name: app
        image: your-app:latest
        env:
        - name: OPENORACLE_API_KEY
          valueFrom:
            secretKeyRef:
              name: oracle-secrets
              key: api-key
```

### Serverless
```typescript
// Vercel/Netlify Functions
import { OracleRouter } from 'openoracle'

export default async function handler(req, res) {
  const router = new OracleRouter({
    providers: ['chainlink', 'pyth'],
    cache: 'memory' // Use memory cache for serverless
  })
  
  const result = await router.query(req.body.question)
  res.json(result)
}
```

## 📚 Documentation

### API Reference
- [Python SDK Documentation](./openoracle-sdk/docs/)
- [Node.js SDK Documentation](./node-sdk/docs/)
- [React SDK Documentation](./openoracle-react/docs/)

### Tutorials
- [Building Your First Prediction Market](./docs/tutorials/prediction-market.md)
- [Oracle Provider Integration](./docs/tutorials/custom-providers.md)
- [Real-time Data Feeds](./docs/tutorials/real-time-feeds.md)
- [AI-Powered Analysis](./docs/tutorials/ai-integration.md)

### Examples
- [Full-Stack Prediction Market](./examples/prediction-market/)
- [DeFi Price Aggregator](./examples/price-aggregator/)
- [Twitter Oracle Bot](./examples/twitter-bot/)
- [Multi-Chain Oracle Router](./examples/multi-chain/)

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Setup
```bash
# Clone the monorepo
git clone https://github.com/openoracle/openoracle.git
cd openoracle/packages

# Install all dependencies
npm run install:all

# Run tests
npm run test:all

# Build all packages
npm run build:all
```

### Release Process
```bash
# Version bump
npm run version:patch  # or minor, major

# Build and test
npm run build:all
npm run test:all

# Publish to registries
npm run publish:all
```

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

## 🌟 Support

- **Documentation**: [docs.openoracle.ai](https://docs.openoracle.ai)
- **GitHub Issues**: [Report bugs or request features](https://github.com/openoracle/openoracle/issues)
- **Discord**: [Join our community](https://discord.gg/openoracle)
- **Twitter**: [@OpenOracle](https://twitter.com/OpenOracle)

## 🎉 Acknowledgments

OpenOracle is built with love by the community and powered by:

- **Oracle Networks**: Chainlink, Pyth, UMA, Band Protocol, API3
- **AI Providers**: OpenAI, Anthropic, Groq, OpenRouter
- **Infrastructure**: React, TypeScript, Python, FastAPI
- **Community**: Our amazing contributors and users

---

<div align="center">

**🔮 Start building the future of prediction markets with OpenOracle**

[Get Started](./docs/quickstart.md) • [Examples](./examples/) • [API Docs](./docs/api/) • [Community](https://discord.gg/openoracle)

</div>