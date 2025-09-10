# @polypoll/react-ai-router

A pure AI routing mechanism for React applications with local LLM support and strict JSON output validation. Built for the PolyPoll prediction market platform but designed as a general-purpose library.

## Features

- 🎯 **Pure AI Routing**: Route-based AI interactions with schema validation
- 🦙 **Local LLM Support**: Run Llama-3 locally with WebLLM/WebGPU  
- 🛡️ **Strict JSON Validation**: Zod-based schema validation with error recovery
- 🔄 **Provider Fallbacks**: Automatic failover between OpenAI, local models
- ⚛️ **React Integration**: Hooks and context for seamless React integration
- 🎛️ **Configuration Presets**: Production-ready configurations out of the box
- 🔁 **Retry Logic**: Smart retry with exponential backoff
- 📊 **Batch Processing**: Process multiple AI requests in parallel

## Installation

```bash
npm install @polypoll/react-ai-router
```

Optional for local LLM support:
```bash
npm install @mlc-ai/web-llm
```

## Quick Start

### Basic Setup

```tsx
import React from 'react';
import {
  AIRouterProvider,
  useAIRouter, 
  generateViralPollRoute,
  AI_CONFIG_PRESETS
} from '@polypoll/react-ai-router';

function App() {
  const config = AI_CONFIG_PRESETS.development('your-openai-api-key');
  
  return (
    <AIRouterProvider config={config}>
      <PollGenerator />
    </AIRouterProvider>
  );
}

function PollGenerator() {
  const { execute, isLoading, error } = useAIRouter(generateViralPollRoute);
  
  const handleGenerate = async () => {
    try {
      const poll = await execute({
        article_data: {
          url: 'https://example.com/news',
          title: 'AI Breakthrough: GPT-5 Announced',
          summary: 'OpenAI unveils next-generation model',
          news_site: 'tech-news.com',
          tags: ['ai', 'gpt5']
        },
        perspective: 'balanced',
        payment_token: 'FLOW'
      });
      
      console.log('Generated poll:', poll);
    } catch (err) {
      console.error('Generation failed:', err);
    }
  };
  
  return (
    <button onClick={handleGenerate} disabled={isLoading}>
      {isLoading ? 'Generating...' : 'Generate Poll'}
    </button>
  );
}
```

### Local LLM Setup (Free, Private)

```tsx
import { AI_CONFIG_PRESETS } from '@polypoll/react-ai-router';

// Use local Llama-3 models (no API keys needed)
const config = AI_CONFIG_PRESETS.localFirst();

function LocalApp() {
  return (
    <AIRouterProvider config={config}>
      {/* Your components */}
    </AIRouterProvider>
  );
}
```

## Configuration

### Environment-Based Configuration

```tsx
import { buildConfigForEnvironment } from '@polypoll/react-ai-router';

// Development: Fast, cheap models with local fallback
const devConfig = buildConfigForEnvironment('development', {
  openai: process.env.REACT_APP_OPENAI_KEY
});

// Production: High-quality models with redundancy  
const prodConfig = buildConfigForEnvironment('production', {
  openai: process.env.REACT_APP_OPENAI_KEY
});
```

### Custom Configuration

```tsx
import { createOpenAIConfig, createWebLLMConfig } from '@polypoll/react-ai-router';

const customConfig = {
  defaultProvider: createOpenAIConfig('your-api-key', 'gpt-4'),
  fallbackProviders: [
    createWebLLMConfig('Llama-3.2-3B-Instruct-q4f32_1'),
    createWebLLMConfig('Llama-3.2-1B-Instruct-q4f32_1') // Fastest fallback
  ],
  enableRetries: true,
  maxRetries: 2,
  timeout: 30000,
  validateOutput: true
};
```

## AI Routes

### Built-in Routes

```tsx
import { 
  generateViralPollRoute,      // Generate viral prediction markets
  generateTwitterPollRoute,    // Binary polls from tweets
  analyzeArticleContextRoute   // Article analysis
} from '@polypoll/react-ai-router';
```

### Custom Routes

```tsx
import { z } from 'zod';

const customRoute = {
  path: '/analysis/sentiment',
  description: 'Analyze sentiment with market predictions',
  inputSchema: z.object({
    text: z.string().min(10),
    domain: z.enum(['tech', 'finance', 'politics'])
  }),
  outputSchema: z.object({
    sentiment: z.number().min(-1).max(1),
    confidence: z.number().min(0).max(1),
    themes: z.array(z.string()),
    prediction: z.string()
  }),
  systemPrompt: 'You are a financial analyst...',
  temperature: 0.4,
  maxTokens: 800
};

// Use with any provider
const { execute } = useAIRouter(customRoute);
```

## Advanced Usage

### Batch Processing

```tsx
import { useAIRouterBatch } from '@polypoll/react-ai-router';

function BatchProcessor() {
  const { executeBatch, isLoading, errors } = useAIRouterBatch();
  
  const processBatch = async () => {
    const requests = articles.map(article => ({
      route: generateViralPollRoute,
      input: { article_data: article, perspective: 'balanced' }
    }));
    
    const results = await executeBatch(requests);
    console.log('Batch results:', results);
  };
  
  return (
    <button onClick={processBatch} disabled={isLoading}>
      Process {articles.length} Articles
    </button>
  );
}
```

### Provider Health Monitoring

```tsx
import { useAIRouterContext } from '@polypoll/react-ai-router';

function ProviderStatus() {
  const { isProviderAvailable } = useAIRouterContext();
  
  return (
    <div>
      <div>OpenAI: {isProviderAvailable('openai') ? '✅' : '❌'}</div>
      <div>WebLLM: {isProviderAvailable('web-llm') ? '✅' : '❌'}</div>
    </div>
  );
}
```

### Error Handling

```tsx
const { execute, error, retry } = useAIRouter(route, {
  onError: (err) => {
    if (err.code === 'VALIDATION_ERROR') {
      console.log('Schema validation failed');
    } else if (err.code === 'RATE_LIMIT') {
      console.log('Rate limited, will auto-retry');
    }
  },
  onSuccess: (response) => {
    console.log('Success:', response);
  }
});
```

## Local LLM Models

### Supported Models

| Model | Size | Speed | Quality | RAM Required |
|-------|------|-------|---------|--------------|
| `Llama-3.2-1B-Instruct-q4f32_1` | 1B | Fast | Good | 2GB |
| `Llama-3.2-3B-Instruct-q4f32_1` | 3B | Medium | Better | 4GB |  
| `Llama-3.1-8B-Instruct-q4f32_1` | 8B | Slow | Best | 8GB |

### WebGPU Requirements

- Chrome/Edge 113+ with WebGPU enabled
- Dedicated GPU with 2GB+ VRAM  
- Hardware acceleration enabled

### Check Support

```tsx
import { isWebLLMSupported, getAvailableWebLLMModels } from '@polypoll/react-ai-router';

const supported = await isWebLLMSupported();
const models = getAvailableWebLLMModels();
```

## JSON Validation

### Automatic Validation

All AI responses are automatically validated against route schemas:

```tsx
// Input validation
const input = MyInputSchema.parse(userInput);

// AI execution with output validation
const output = await execute(input); // Automatically validated

// Custom validation
import { validateJSON } from '@polypoll/react-ai-router';

const validated = validateJSON(rawResponse, MySchema, 'openai');
```

### Error Recovery

The library includes multiple JSON parsing strategies:

1. Direct JSON parsing
2. Markdown code block extraction  
3. Regex-based JSON extraction
4. Common error repair (trailing commas, quotes)
5. Manual key-value extraction

## Configuration Presets

### Available Presets

```tsx
// Production: OpenAI primary, WebLLM fallback
AI_CONFIG_PRESETS.production(apiKey)

// Development: Cheaper models, local fallback
AI_CONFIG_PRESETS.development(apiKey)

// Local-first: Privacy focused, no API calls
AI_CONFIG_PRESETS.localFirst()

// Cost-optimized: Minimize API costs
AI_CONFIG_PRESETS.costOptimized(apiKey)

// Performance: Best quality models
AI_CONFIG_PRESETS.performance(apiKey)
```

### Optimal Provider Selection

```tsx
import { getOptimalProvider } from '@polypoll/react-ai-router';

const provider = getOptimalProvider({
  speed: 'fast',      // fast | medium | slow
  cost: 'low',        // low | medium | high  
  quality: 'good',    // basic | good | premium
  privacy: 'local'    // cloud | local
}, { openai: apiKey });
```

## API Reference

### Hooks

- `useAIRouter(route, options?)` - Execute single AI route
- `useAIRouterBatch()` - Execute multiple routes in parallel
- `useAIRouterContext()` - Access router context
- `useAIRouterStream(route, options?)` - Streaming responses (planned)

### Components

- `<AIRouterProvider config={config}>` - Provide AI context
- `withAIRouter(Component, config)` - HOC for AI context

### Utilities

- `validateJSON(content, schema, provider)` - Validate JSON responses
- `buildConfigForEnvironment(env, keys)` - Environment-based config
- `isWebLLMSupported()` - Check WebLLM compatibility

## Examples

See the `/examples` directory for complete examples:

- `basic-usage.tsx` - Getting started guide
- `advanced-usage.tsx` - Complex scenarios and error handling
- `local-llm-demo.tsx` - WebLLM integration
- `poll-generation.tsx` - PolyPoll-specific examples

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality  
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- 📖 Documentation: [Full API docs](./docs)
- 🐛 Issues: [GitHub Issues](https://github.com/polypoll/react-ai-router/issues)  
- 💬 Discord: [PolyPoll Community](https://discord.gg/polypoll)

---

Built with ❤️ for the PolyPoll prediction market ecosystem.