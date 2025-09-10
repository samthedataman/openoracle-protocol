import React, { useState, useEffect } from 'react';
import {
  AIRouterProvider,
  useAIRouter,
  useAIRouterBatch,
  useAIRouterContext,
  generateViralPollRoute,
  generateTwitterPollRoute,
  analyzeArticleContextRoute,
  createOpenAIConfig,
  createWebLLMConfig,
  isWebLLMSupported,
  z
} from '../src';

// Example 1: Advanced Configuration with Fallback Chain
function AdvancedApp() {
  const [webLLMSupported, setWebLLMSupported] = useState<boolean | null>(null);

  useEffect(() => {
    isWebLLMSupported().then(setWebLLMSupported);
  }, []);

  // Create configuration with intelligent fallback
  const config = {
    defaultProvider: createOpenAIConfig(process.env.REACT_APP_OPENAI_KEY || ''),
    fallbackProviders: webLLMSupported ? [
      createWebLLMConfig('Llama-3.2-3B-Instruct-q4f32_1'),
      createWebLLMConfig('Llama-3.2-1B-Instruct-q4f32_1')
    ] : [],
    enableRetries: true,
    maxRetries: 2,
    timeout: 30000,
    validateOutput: true
  };

  return (
    <AIRouterProvider config={config}>
      <div className="advanced-app">
        <h1>Advanced AI Router Demo</h1>
        <ProviderStatus />
        <BatchProcessingDemo />
        <CustomRouteDemo />
        <ErrorHandlingDemo />
      </div>
    </AIRouterProvider>
  );
}

// Example 2: Provider Status and Health Check
function ProviderStatus() {
  const { config, isProviderAvailable } = useAIRouterContext();
  const [providerTests, setProviderTests] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const testProviders = async () => {
      const tests = {
        openai: isProviderAvailable('openai'),
        webllm: isProviderAvailable('web-llm')
      };
      setProviderTests(tests);
    };

    testProviders();
    const interval = setInterval(testProviders, 30000); // Test every 30s
    
    return () => clearInterval(interval);
  }, [isProviderAvailable]);

  return (
    <div className="provider-status">
      <h2>Provider Status</h2>
      <div className="status-grid">
        <div className={`provider ${providerTests.openai ? 'available' : 'unavailable'}`}>
          <span className="provider-name">OpenAI</span>
          <span className="status-icon">{providerTests.openai ? '✅' : '❌'}</span>
        </div>
        <div className={`provider ${providerTests.webllm ? 'available' : 'unavailable'}`}>
          <span className="provider-name">WebLLM</span>
          <span className="status-icon">{providerTests.webllm ? '✅' : '❌'}</span>
        </div>
      </div>
      
      <div className="config-info">
        <h3>Current Configuration</h3>
        <pre>{JSON.stringify(config, null, 2)}</pre>
      </div>
    </div>
  );
}

// Example 3: Batch Processing Multiple Articles
function BatchProcessingDemo() {
  const { executeBatch, isLoading, errors, responses } = useAIRouterBatch();
  const [results, setResults] = useState<any[]>([]);

  const handleBatchProcessing = async () => {
    const articles = [
      {
        url: 'https://example.com/ai-news',
        title: 'AI Startup Raises $100M Series A',
        summary: 'New company promises AGI breakthrough',
        news_site: 'tech-news.com',
        tags: ['ai', 'startup', 'funding']
      },
      {
        url: 'https://example.com/crypto-news', 
        title: 'Bitcoin Hits New All-Time High',
        summary: 'BTC surges past previous records',
        news_site: 'crypto-daily.com',
        tags: ['bitcoin', 'crypto', 'ath']
      },
      {
        url: 'https://example.com/tech-news',
        title: 'Apple Announces Revolutionary VR Headset',
        summary: 'Vision Pro successor promises 8K per eye',
        news_site: 'apple-insider.com', 
        tags: ['apple', 'vr', 'vision-pro']
      }
    ];

    try {
      const batchRequests = articles.map(article => ({
        route: generateViralPollRoute,
        input: {
          article_data: article,
          perspective: 'balanced' as const,
          payment_token: 'FLOW' as const
        }
      }));

      const batchResults = await executeBatch(batchRequests);
      setResults(batchResults);
    } catch (error) {
      console.error('Batch processing failed:', error);
    }
  };

  return (
    <div className="batch-demo">
      <h2>Batch Processing Demo</h2>
      <button 
        onClick={handleBatchProcessing}
        disabled={isLoading}
        className="batch-btn"
      >
        {isLoading ? 'Processing Batch...' : 'Process 3 Articles'}
      </button>

      {isLoading && (
        <div className="batch-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${(responses.filter(Boolean).length / 3) * 100}%` }}
            />
          </div>
          <p>Processing {responses.filter(Boolean).length}/3 articles...</p>
        </div>
      )}

      {errors.some(Boolean) && (
        <div className="batch-errors">
          <h3>Errors:</h3>
          {errors.map((error, index) => 
            error && (
              <div key={index} className="error">
                Article {index + 1}: {error.message}
              </div>
            )
          )}
        </div>
      )}

      {results.length > 0 && (
        <div className="batch-results">
          <h3>Generated Polls:</h3>
          {results.map((poll, index) => (
            <div key={index} className="poll-card">
              <h4>Article {index + 1}</h4>
              <p className="question">{poll.question}</p>
              <div className="quick-options">
                <span className="option">🚀 {poll.serial_optimism}</span>
                <span className="option">💀 {poll.pessimistic}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Example 4: Custom Route Definition
const CustomAnalysisRoute = {
  path: '/custom/sentiment-analysis',
  description: 'Custom sentiment analysis with market predictions',
  inputSchema: z.object({
    text: z.string().min(10),
    domain: z.enum(['tech', 'finance', 'politics'])
  }),
  outputSchema: z.object({
    sentiment: z.number().min(-1).max(1),
    confidence: z.number().min(0).max(1),
    key_themes: z.array(z.string()),
    market_prediction: z.string(),
    risk_factors: z.array(z.string())
  }),
  systemPrompt: `You are a financial analyst AI. Analyze the given text and provide:
1. Sentiment score (-1 to 1)
2. Confidence in analysis (0 to 1) 
3. Key themes identified
4. Market prediction based on content
5. Risk factors to consider

Always respond with valid JSON matching the schema.`,
  temperature: 0.4,
  maxTokens: 800
};

function CustomRouteDemo() {
  const [input, setInput] = useState({
    text: 'Fed announces dovish stance, markets rally on rate cut hopes',
    domain: 'finance' as const
  });
  
  const { execute, isLoading, error, response } = useAIRouter(CustomAnalysisRoute);

  const handleAnalysis = async () => {
    try {
      const result = await execute(input);
      console.log('Custom analysis result:', result);
    } catch (err) {
      console.error('Analysis failed:', err);
    }
  };

  return (
    <div className="custom-route-demo">
      <h2>Custom Route Demo</h2>
      
      <div className="input-section">
        <textarea
          value={input.text}
          onChange={(e) => setInput({ ...input, text: e.target.value })}
          placeholder="Enter text to analyze..."
          rows={4}
          className="analysis-input"
        />
        
        <select
          value={input.domain}
          onChange={(e) => setInput({ ...input, domain: e.target.value as any })}
          className="domain-select"
        >
          <option value="tech">Technology</option>
          <option value="finance">Finance</option>
          <option value="politics">Politics</option>
        </select>
      </div>

      <button 
        onClick={handleAnalysis}
        disabled={isLoading}
        className="analyze-btn"
      >
        {isLoading ? 'Analyzing...' : 'Run Custom Analysis'}
      </button>

      {error && (
        <div className="error">
          Analysis Error: {error.message}
        </div>
      )}

      {response?.parsed && (
        <div className="analysis-result">
          <h3>Analysis Results</h3>
          <div className="result-grid">
            <div className="metric">
              <label>Sentiment:</label>
              <span className={response.parsed.sentiment > 0 ? 'positive' : 'negative'}>
                {response.parsed.sentiment.toFixed(2)}
              </span>
            </div>
            <div className="metric">
              <label>Confidence:</label>
              <span>{(response.parsed.confidence * 100).toFixed(1)}%</span>
            </div>
          </div>
          
          <div className="themes">
            <h4>Key Themes:</h4>
            <ul>
              {response.parsed.key_themes.map((theme, index) => (
                <li key={index}>{theme}</li>
              ))}
            </ul>
          </div>

          <div className="prediction">
            <h4>Market Prediction:</h4>
            <p>{response.parsed.market_prediction}</p>
          </div>

          <div className="risks">
            <h4>Risk Factors:</h4>
            <ul>
              {response.parsed.risk_factors.map((risk, index) => (
                <li key={index}>{risk}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// Example 5: Error Handling and Recovery
function ErrorHandlingDemo() {
  const [forceError, setForceError] = useState(false);
  
  const badRoute = {
    ...generateViralPollRoute,
    // Intentionally break the route for demo
    outputSchema: z.object({
      impossible_field: z.string().min(1000000) // Will cause validation error
    })
  };

  const { execute, isLoading, error, retry } = useAIRouter(
    forceError ? badRoute : generateViralPollRoute,
    {
      onError: (err) => {
        console.error('Route execution failed:', err);
        
        // Could implement custom error reporting here
        if (err.code === 'VALIDATION_ERROR') {
          console.log('This is a validation error, might need schema fix');
        } else if (err.code === 'RATE_LIMIT') {
          console.log('Rate limited, will retry automatically');
        }
      },
      onSuccess: (response) => {
        console.log('Route executed successfully:', response);
      }
    }
  );

  const handleTest = async () => {
    try {
      await execute({
        article_data: {
          url: 'https://example.com/test',
          title: 'Test Article for Error Handling',
          summary: 'This is a test article',
          news_site: 'test.com',
          tags: ['test']
        },
        perspective: 'balanced' as const,
        payment_token: 'FLOW' as const
      });
    } catch (err) {
      // Error already handled by onError callback
    }
  };

  return (
    <div className="error-demo">
      <h2>Error Handling Demo</h2>
      
      <div className="error-controls">
        <label>
          <input
            type="checkbox"
            checked={forceError}
            onChange={(e) => setForceError(e.target.checked)}
          />
          Force validation error
        </label>
      </div>

      <button 
        onClick={handleTest}
        disabled={isLoading}
        className="test-btn"
      >
        {isLoading ? 'Testing...' : 'Test Error Handling'}
      </button>

      {error && (
        <div className="error-details">
          <h3>Error Details</h3>
          <div className="error-info">
            <p><strong>Provider:</strong> {error.provider}</p>
            <p><strong>Code:</strong> {error.code}</p>
            <p><strong>Message:</strong> {error.message}</p>
          </div>
          
          <button onClick={retry} className="retry-btn">
            Retry Request
          </button>
        </div>
      )}
    </div>
  );
}

export default AdvancedApp;