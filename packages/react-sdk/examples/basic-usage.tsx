import React, { useState } from 'react';
import {
  AIRouterProvider,
  useAIRouter,
  generateViralPollRoute,
  AI_CONFIG_PRESETS,
  ViralPollResponse,
  PollGenerationRequest
} from '../src';

// Example 1: Basic Setup with OpenAI
function App() {
  const config = AI_CONFIG_PRESETS.development('your-openai-api-key');

  return (
    <AIRouterProvider config={config}>
      <PollGenerator />
      <LocalLLMDemo />
    </AIRouterProvider>
  );
}

// Example 2: Generate Viral Poll from Article
function PollGenerator() {
  const [isLoading, setIsLoading] = useState(false);
  const [poll, setPoll] = useState<ViralPollResponse | null>(null);
  
  const { execute, error } = useAIRouter(generateViralPollRoute);

  const handleGeneratePoll = async () => {
    setIsLoading(true);
    try {
      const input: PollGenerationRequest = {
        article_data: {
          url: 'https://example.com/ai-breakthrough',
          title: 'OpenAI Announces GPT-5 with 10x Performance Boost',
          summary: 'New model shows dramatic improvements in reasoning and efficiency',
          news_site: 'tech-news.com',
          tags: ['ai', 'openai', 'gpt5']
        },
        perspective: 'balanced',
        payment_token: 'FLOW'
      };

      const result = await execute(input);
      setPoll(result);
    } catch (err) {
      console.error('Failed to generate poll:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="poll-generator">
      <h2>Viral Poll Generator</h2>
      <button 
        onClick={handleGeneratePoll} 
        disabled={isLoading}
        className="generate-btn"
      >
        {isLoading ? 'Generating...' : 'Generate Poll'}
      </button>

      {error && (
        <div className="error">
          Error: {error.message}
        </div>
      )}

      {poll && (
        <div className="poll-result">
          <h3>{poll.question}</h3>
          
          <div className="options">
            <div className="option optimist">
              🚀 <strong>Serial Optimism:</strong> {poll.serial_optimism}
            </div>
            <div className="option contrarian">
              🔄 <strong>Contrarian:</strong> {poll.contrarian}
            </div>
            <div className="option pessimist">
              💀 <strong>Pessimistic:</strong> {poll.pessimistic}
            </div>
            <div className="option hottake">
              🔥 <strong>Hot Take:</strong> {poll.hottake}
            </div>
          </div>

          <div className="metadata">
            <p><strong>Viral Score:</strong> {poll.metadata.viral_score.toFixed(2)}</p>
            <p><strong>Category:</strong> {poll.category}</p>
            <p><strong>Share Text:</strong> {poll.metadata.share_text}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Example 3: Local LLM with WebLLM
function LocalLLMDemo() {
  const [isInitializing, setIsInitializing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const config = AI_CONFIG_PRESETS.localFirst(); // Uses WebLLM only

  const handleLocalGeneration = async () => {
    setIsInitializing(true);
    
    try {
      // Create a local-only router
      const localConfig = {
        ...config,
        defaultProvider: {
          provider: 'web-llm' as const,
          model: 'Llama-3.2-1B-Instruct-q4f32_1',
          temperature: 0.7,
          maxTokens: 500
        }
      };

      // This would use the local LLM
      setResult('Local LLM generation would happen here with WebLLM');
    } catch (error) {
      console.error('Local generation failed:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="local-llm-demo">
      <h2>Local LLM Demo</h2>
      <p>Run Llama-3 locally in your browser with WebGPU</p>
      
      <button 
        onClick={handleLocalGeneration}
        disabled={isInitializing}
        className="local-btn"
      >
        {isInitializing ? 'Initializing Model...' : 'Generate Locally'}
      </button>

      {result && (
        <div className="local-result">
          <h3>Local Generation Result:</h3>
          <p>{result}</p>
        </div>
      )}
    </div>
  );
}

export default App;