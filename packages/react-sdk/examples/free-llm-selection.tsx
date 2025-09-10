import React, { useState, useEffect } from 'react';
import {
  AIRouterProvider,
  useAIRouter,
  useAIRouterContext,
  createWebLLMConfig,
  isWebLLMSupported,
  generateViralPollRoute,
  z
} from '../src';

/**
 * FREE LLM SELECTION COMPONENT
 * 
 * This example shows how users can choose from various free LLMs that adhere to OpenAI standards:
 * 
 * 1. LOCAL MODELS (WebLLM) - Completely free, runs in browser
 * 2. FREE OPENAI-COMPATIBLE APIs - Various providers offering free tiers
 * 3. OPENROUTER FREE MODELS - Free models via OpenRouter API
 */

// ============ FREE LLM OPTIONS ============

interface FreeLLMOption {
  id: string
  name: string
  provider: 'webllm' | 'openai-compatible' | 'openrouter-free'
  description: string
  pros: string[]
  cons: string[]
  setup: {
    requiresApi: boolean
    steps: string[]
  }
  performance: {
    speed: 'fast' | 'medium' | 'slow'
    quality: 'high' | 'medium' | 'basic'
    privacy: 'complete' | 'good' | 'basic'
  }
}

const FREE_LLM_OPTIONS: FreeLLMOption[] = [
  // LOCAL WEBLLM MODELS (Completely Free)
  {
    id: 'llama-3.2-3b',
    name: 'Llama 3.2 3B (Local)',
    provider: 'webllm',
    description: 'Meta\'s Llama 3.2 3B model running locally in your browser',
    pros: [
      'Completely free forever',
      'Complete privacy - nothing leaves your device',
      'No API keys needed',
      'Works offline once loaded',
      'Good reasoning capabilities'
    ],
    cons: [
      'Requires modern GPU (WebGPU support)',
      'Initial download ~2GB',
      'Slower than cloud models',
      'Limited context window'
    ],
    setup: {
      requiresApi: false,
      steps: [
        'Enable WebGPU in your browser',
        'Click "Use Local Model"',
        'Wait for initial download (~2GB)',
        'Model ready to use!'
      ]
    },
    performance: {
      speed: 'medium',
      quality: 'medium',
      privacy: 'complete'
    }
  },
  {
    id: 'llama-3.2-1b',
    name: 'Llama 3.2 1B (Local)',
    provider: 'webllm',
    description: 'Smaller, faster version of Llama 3.2',
    pros: [
      'Completely free',
      'Smaller download (~800MB)',
      'Faster inference',
      'Good for simple tasks'
    ],
    cons: [
      'Lower quality than 3B model',
      'Limited reasoning',
      'Still requires WebGPU'
    ],
    setup: {
      requiresApi: false,
      steps: [
        'Enable WebGPU in browser',
        'Select Llama 3.2 1B',
        'Wait for download',
        'Ready to use'
      ]
    },
    performance: {
      speed: 'fast',
      quality: 'basic',
      privacy: 'complete'
    }
  },
  {
    id: 'phi-3.5-mini',
    name: 'Phi-3.5 Mini (Local)',
    provider: 'webllm',
    description: 'Microsoft\'s efficient small language model',
    pros: [
      'Excellent for coding tasks',
      'Very fast inference',
      'Good reasoning despite size'
    ],
    cons: [
      'Specialized for certain tasks',
      'Limited general knowledge'
    ],
    setup: {
      requiresApi: false,
      steps: [
        'Check WebGPU compatibility',
        'Select Phi-3.5 Mini',
        'Download and initialize'
      ]
    },
    performance: {
      speed: 'fast',
      quality: 'medium',
      privacy: 'complete'
    }
  },
  
  // FREE OPENAI-COMPATIBLE APIS
  {
    id: 'groq-llama',
    name: 'Groq Llama 3.1 70B (Free Tier)',
    provider: 'openai-compatible',
    description: 'Ultra-fast inference via Groq\'s LPU chips',
    pros: [
      'Extremely fast (500+ tokens/sec)',
      'High quality responses',
      'Generous free tier',
      'OpenAI-compatible API'
    ],
    cons: [
      'Requires free Groq account',
      'Rate limits on free tier',
      'API calls go to Groq servers'
    ],
    setup: {
      requiresApi: true,
      steps: [
        'Sign up at console.groq.com',
        'Get free API key',
        'Use base URL: https://api.groq.com/openai/v1',
        'Model: llama-3.1-70b-versatile'
      ]
    },
    performance: {
      speed: 'fast',
      quality: 'high',
      privacy: 'good'
    }
  },
  {
    id: 'together-llama',
    name: 'Together AI Llama 3.1 (Free)',
    provider: 'openai-compatible',
    description: 'Free access to Llama models via Together AI',
    pros: [
      'Multiple model options',
      'Good free tier limits',
      'OpenAI API compatibility',
      'Fast inference'
    ],
    cons: [
      'Requires account signup',
      'Monthly free limits',
      'Data sent to Together AI'
    ],
    setup: {
      requiresApi: true,
      steps: [
        'Create account at together.ai',
        'Generate API key',
        'Base URL: https://api.together.xyz/v1',
        'Choose from various Llama models'
      ]
    },
    performance: {
      speed: 'fast',
      quality: 'high',
      privacy: 'good'
    }
  },
  
  // OPENROUTER FREE MODELS
  {
    id: 'openrouter-free-models',
    name: 'OpenRouter Free Models',
    provider: 'openrouter-free',
    description: 'Various free models available through OpenRouter',
    pros: [
      'Access to multiple free models',
      'Easy switching between models',
      'Some models completely free',
      'Good model variety'
    ],
    cons: [
      'Some models have usage limits',
      'Quality varies by model',
      'Requires OpenRouter account'
    ],
    setup: {
      requiresApi: true,
      steps: [
        'Sign up at openrouter.ai',
        'Get API key (free tier available)',
        'Use models with $0.00 pricing',
        'Examples: google/gemma-2-9b-it:free'
      ]
    },
    performance: {
      speed: 'medium',
      quality: 'medium',
      privacy: 'basic'
    }
  }
]

// ============ MAIN COMPONENT ============

export default function FreeLLMSelectionDemo() {
  const [selectedLLM, setSelectedLLM] = useState<FreeLLMOption | null>(null)
  const [webLLMSupported, setWebLLMSupported] = useState<boolean | null>(null)
  const [customApiConfig, setCustomApiConfig] = useState({
    baseUrl: '',
    apiKey: '',
    model: ''
  })

  useEffect(() => {
    isWebLLMSupported().then(setWebLLMSupported)
  }, [])

  return (
    <div className="free-llm-demo">
      <div className="header">
        <h1>🆓 Choose Your Free LLM</h1>
        <p>Select from completely free, open-source models that follow OpenAI API standards</p>
      </div>

      <div className="llm-grid">
        {FREE_LLM_OPTIONS.map((llm) => (
          <LLMOptionCard
            key={llm.id}
            option={llm}
            isSelected={selectedLLM?.id === llm.id}
            isSupported={llm.provider === 'webllm' ? webLLMSupported : true}
            onSelect={() => setSelectedLLM(llm)}
          />
        ))}
      </div>

      {selectedLLM && (
        <div className="selected-llm-details">
          <LLMSetupGuide 
            option={selectedLLM} 
            customConfig={customApiConfig}
            onConfigChange={setCustomApiConfig}
          />
          
          <LLMTester selectedLLM={selectedLLM} customConfig={customApiConfig} />
        </div>
      )}

      <div className="comparison-table">
        <h2>📊 Quick Comparison</h2>
        <ComparisonTable options={FREE_LLM_OPTIONS} />
      </div>
    </div>
  )
}

// ============ LLM OPTION CARD ============

interface LLMOptionCardProps {
  option: FreeLLMOption
  isSelected: boolean
  isSupported: boolean | null
  onSelect: () => void
}

function LLMOptionCard({ option, isSelected, isSupported, onSelect }: LLMOptionCardProps) {
  const getSupportText = () => {
    if (option.provider === 'webllm') {
      if (isSupported === null) return '🔄 Checking...'
      if (isSupported === false) return '❌ WebGPU not supported'
      return '✅ Supported'
    }
    return '✅ Available'
  }

  const getProviderIcon = () => {
    switch (option.provider) {
      case 'webllm': return '💻'
      case 'openai-compatible': return '🚀'
      case 'openrouter-free': return '🔀'
      default: return '🤖'
    }
  }

  return (
    <div 
      className={`llm-card ${isSelected ? 'selected' : ''} ${isSupported === false ? 'disabled' : ''}`}
      onClick={isSupported !== false ? onSelect : undefined}
    >
      <div className="card-header">
        <span className="provider-icon">{getProviderIcon()}</span>
        <h3>{option.name}</h3>
        <span className={`support-badge ${isSupported ? 'supported' : 'unsupported'}`}>
          {getSupportText()}
        </span>
      </div>
      
      <p className="description">{option.description}</p>
      
      <div className="performance-metrics">
        <div className="metric">
          <span className="label">Speed:</span>
          <span className={`value speed-${option.performance.speed}`}>
            {option.performance.speed}
          </span>
        </div>
        <div className="metric">
          <span className="label">Quality:</span>
          <span className={`value quality-${option.performance.quality}`}>
            {option.performance.quality}
          </span>
        </div>
        <div className="metric">
          <span className="label">Privacy:</span>
          <span className={`value privacy-${option.performance.privacy}`}>
            {option.performance.privacy}
          </span>
        </div>
      </div>

      <div className="quick-pros-cons">
        <div className="pros">
          <strong>✅ Pros:</strong>
          <ul>
            {option.pros.slice(0, 2).map((pro, idx) => (
              <li key={idx}>{pro}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ============ SETUP GUIDE ============

interface LLMSetupGuideProps {
  option: FreeLLMOption
  customConfig: any
  onConfigChange: (config: any) => void
}

function LLMSetupGuide({ option, customConfig, onConfigChange }: LLMSetupGuideProps) {
  return (
    <div className="setup-guide">
      <h2>🛠️ Setup Guide: {option.name}</h2>
      
      <div className="setup-steps">
        <h3>Setup Steps:</h3>
        <ol>
          {option.setup.steps.map((step, idx) => (
            <li key={idx}>{step}</li>
          ))}
        </ol>
      </div>

      {option.setup.requiresApi && (
        <div className="api-config">
          <h3>API Configuration:</h3>
          <div className="config-form">
            <div className="form-group">
              <label>Base URL:</label>
              <input
                type="text"
                placeholder="https://api.groq.com/openai/v1"
                value={customConfig.baseUrl}
                onChange={(e) => onConfigChange({ ...customConfig, baseUrl: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>API Key:</label>
              <input
                type="password"
                placeholder="Your free API key"
                value={customConfig.apiKey}
                onChange={(e) => onConfigChange({ ...customConfig, apiKey: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Model Name:</label>
              <input
                type="text"
                placeholder="llama-3.1-70b-versatile"
                value={customConfig.model}
                onChange={(e) => onConfigChange({ ...customConfig, model: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}

      <div className="pros-cons-detailed">
        <div className="pros-detailed">
          <h4>✅ Advantages:</h4>
          <ul>
            {option.pros.map((pro, idx) => (
              <li key={idx}>{pro}</li>
            ))}
          </ul>
        </div>
        <div className="cons-detailed">
          <h4>⚠️ Considerations:</h4>
          <ul>
            {option.cons.map((con, idx) => (
              <li key={idx}>{con}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ============ LLM TESTER ============

interface LLMTesterProps {
  selectedLLM: FreeLLMOption
  customConfig: any
}

function LLMTester({ selectedLLM, customConfig }: LLMTesterProps) {
  // Create dynamic configuration based on selected LLM
  const createProviderConfig = () => {
    if (selectedLLM.provider === 'webllm') {
      return createWebLLMConfig(selectedLLM.id.includes('llama-3.2-3b') 
        ? 'Llama-3.2-3B-Instruct-q4f32_1'
        : selectedLLM.id.includes('llama-3.2-1b')
        ? 'Llama-3.2-1B-Instruct-q4f32_1'
        : 'Phi-3.5-mini-instruct-q4f16_1'
      )
    } else {
      // For API-based models, create OpenAI-compatible config
      return {
        provider: 'openai' as const,
        apiKey: customConfig.apiKey || 'demo-key',
        baseUrl: customConfig.baseUrl || 'https://api.groq.com/openai/v1',
        model: customConfig.model || 'llama-3.1-70b-versatile',
        maxTokens: 500,
        temperature: 0.7
      }
    }
  }

  const config = {
    defaultProvider: createProviderConfig(),
    fallbackProviders: [],
    enableRetries: true,
    maxRetries: 1,
    timeout: 30000
  }

  return (
    <AIRouterProvider config={config}>
      <div className="llm-tester">
        <h2>🧪 Test {selectedLLM.name}</h2>
        <TestInterface selectedLLM={selectedLLM} />
      </div>
    </AIRouterProvider>
  )
}

function TestInterface({ selectedLLM }: { selectedLLM: FreeLLMOption }) {
  const [testPrompt, setTestPrompt] = useState('Create a prediction market question about renewable energy adoption.')
  const { execute, isLoading, error, response } = useAIRouter(generateViralPollRoute)

  const handleTest = async () => {
    try {
      await execute({
        article_data: {
          url: 'https://example.com/test',
          title: 'Renewable Energy Test Article',
          summary: testPrompt,
          news_site: 'test.com',
          tags: ['energy', 'test']
        },
        perspective: 'balanced' as const,
        payment_token: 'FLOW' as const
      })
    } catch (err) {
      console.error('Test failed:', err)
    }
  }

  return (
    <div className="test-interface">
      <div className="test-input">
        <textarea
          value={testPrompt}
          onChange={(e) => setTestPrompt(e.target.value)}
          placeholder="Enter a test prompt..."
          rows={3}
        />
        <button 
          onClick={handleTest} 
          disabled={isLoading}
          className="test-btn"
        >
          {isLoading ? `Testing ${selectedLLM.name}...` : 'Test Model'}
        </button>
      </div>

      {error && (
        <div className="test-error">
          <h4>❌ Error:</h4>
          <p>{error.message}</p>
          <details>
            <summary>Technical Details</summary>
            <pre>{JSON.stringify(error, null, 2)}</pre>
          </details>
        </div>
      )}

      {response?.parsed && (
        <div className="test-result">
          <h4>✅ Success! Generated Poll:</h4>
          <div className="generated-poll">
            <p className="question">📊 <strong>{response.parsed.question}</strong></p>
            <div className="poll-options">
              {response.parsed.quick_options?.map((option: any, idx: number) => (
                <div key={idx} className="option">
                  <span className="option-text">{option.text}</span>
                  <span className="option-emoji">{option.emoji}</span>
                </div>
              ))}
            </div>
            <div className="viral-metrics">
              <span>🔥 Viral Score: {response.parsed.viral_score}</span>
              <span>💭 Engagement: {response.parsed.engagement_score}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============ COMPARISON TABLE ============

function ComparisonTable({ options }: { options: FreeLLMOption[] }) {
  return (
    <div className="comparison-table-container">
      <table className="comparison-table">
        <thead>
          <tr>
            <th>Model</th>
            <th>Provider</th>
            <th>Cost</th>
            <th>Speed</th>
            <th>Quality</th>
            <th>Privacy</th>
            <th>Setup</th>
          </tr>
        </thead>
        <tbody>
          {options.map((option) => (
            <tr key={option.id}>
              <td>{option.name}</td>
              <td>
                <span className="provider-badge">
                  {option.provider === 'webllm' && '💻 Local'}
                  {option.provider === 'openai-compatible' && '🚀 API'}
                  {option.provider === 'openrouter-free' && '🔀 OpenRouter'}
                </span>
              </td>
              <td>
                <span className="cost-badge free">
                  {option.provider === 'webllm' ? '100% Free' : 'Free Tier'}
                </span>
              </td>
              <td>
                <span className={`performance-badge speed-${option.performance.speed}`}>
                  {option.performance.speed}
                </span>
              </td>
              <td>
                <span className={`performance-badge quality-${option.performance.quality}`}>
                  {option.performance.quality}
                </span>
              </td>
              <td>
                <span className={`performance-badge privacy-${option.performance.privacy}`}>
                  {option.performance.privacy}
                </span>
              </td>
              <td>
                <span className="setup-badge">
                  {option.setup.requiresApi ? 'API Key' : 'Click & Go'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}