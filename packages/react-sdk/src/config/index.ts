import { 
  AIRouterConfig, 
  AIProviderConfig, 
  OpenAIConfig, 
  LocalLLMConfig,
  AIProvider
} from '../types/ai';

/**
 * Default configuration for OpenAI provider
 */
export const createOpenAIConfig = (apiKey: string, model = 'gpt-4'): OpenAIConfig => ({
  provider: 'openai',
  model,
  apiKey,
  temperature: 0.7,
  maxTokens: 2000,
  timeout: 30000
});

/**
 * Default configuration for WebLLM provider  
 */
export const createWebLLMConfig = (model = 'Llama-3.2-1B-Instruct-q4f32_1'): LocalLLMConfig => ({
  provider: 'web-llm',
  model,
  temperature: 0.7,
  maxTokens: 2000,
  timeout: 60000 // Longer timeout for local inference
});

/**
 * Configuration presets for different use cases
 */
export const AI_CONFIG_PRESETS = {
  /**
   * Production setup with OpenAI primary, WebLLM fallback
   */
  production: (openaiKey: string): AIRouterConfig => ({
    defaultProvider: createOpenAIConfig(openaiKey, 'gpt-4'),
    fallbackProviders: [
      createWebLLMConfig('Llama-3.2-3B-Instruct-q4f32_1')
    ],
    enableRetries: true,
    maxRetries: 2,
    timeout: 30000,
    validateOutput: true
  }),

  /**
   * Development setup with faster, cheaper models
   */
  development: (openaiKey: string): AIRouterConfig => ({
    defaultProvider: createOpenAIConfig(openaiKey, 'gpt-3.5-turbo'),
    fallbackProviders: [
      createWebLLMConfig('Llama-3.2-1B-Instruct-q4f32_1')
    ],
    enableRetries: true,
    maxRetries: 1,
    timeout: 20000,
    validateOutput: true
  }),

  /**
   * Local-first setup for privacy/offline use
   */
  localFirst: (): AIRouterConfig => ({
    defaultProvider: createWebLLMConfig('Llama-3.2-3B-Instruct-q4f32_1'),
    fallbackProviders: [
      createWebLLMConfig('Llama-3.2-1B-Instruct-q4f32_1')
    ],
    enableRetries: true,
    maxRetries: 2,
    timeout: 60000,
    validateOutput: true
  }),

  /**
   * Cost-optimized setup
   */
  costOptimized: (openaiKey: string): AIRouterConfig => ({
    defaultProvider: createWebLLMConfig('Llama-3.2-1B-Instruct-q4f32_1'),
    fallbackProviders: [
      createOpenAIConfig(openaiKey, 'gpt-3.5-turbo')
    ],
    enableRetries: true,
    maxRetries: 1,
    timeout: 45000,
    validateOutput: true
  }),

  /**
   * High-performance setup for demanding applications
   */
  performance: (openaiKey: string): AIRouterConfig => ({
    defaultProvider: createOpenAIConfig(openaiKey, 'gpt-4-turbo'),
    fallbackProviders: [
      createOpenAIConfig(openaiKey, 'gpt-4'),
      createWebLLMConfig('Llama-3.1-8B-Instruct-q4f32_1')
    ],
    enableRetries: true,
    maxRetries: 3,
    timeout: 45000,
    validateOutput: true
  })
};

/**
 * Provider capability matrix
 */
export const PROVIDER_CAPABILITIES = {
  'openai': {
    jsonMode: true,
    streaming: true,
    functionCalling: true,
    multimodal: false,
    maxTokens: 4000,
    costPerToken: 0.00003, // Approximate for gpt-3.5-turbo
    latency: 'low'
  },
  'web-llm': {
    jsonMode: false, // Requires prompt engineering
    streaming: true,
    functionCalling: false,
    multimodal: false,
    maxTokens: 2000,
    costPerToken: 0, // Free but uses local compute
    latency: 'medium'
  },
  'local-llm': {
    jsonMode: false,
    streaming: true, 
    functionCalling: false,
    multimodal: false,
    maxTokens: 2000,
    costPerToken: 0,
    latency: 'high'
  }
} as const;

/**
 * Recommended models by use case
 */
export const MODEL_RECOMMENDATIONS = {
  // Fast, lightweight tasks
  lightweight: {
    openai: 'gpt-3.5-turbo',
    webllm: 'Llama-3.2-1B-Instruct-q4f32_1'
  },
  
  // Balanced performance/cost
  balanced: {
    openai: 'gpt-4',
    webllm: 'Llama-3.2-3B-Instruct-q4f32_1'
  },
  
  // Maximum quality
  premium: {
    openai: 'gpt-4-turbo',
    webllm: 'Llama-3.1-8B-Instruct-q4f32_1'
  }
};

/**
 * Environment-based configuration builder
 */
export const buildConfigForEnvironment = (
  env: 'development' | 'production' | 'testing',
  apiKeys: { openai?: string } = {}
): AIRouterConfig => {
  switch (env) {
    case 'development':
      return apiKeys.openai 
        ? AI_CONFIG_PRESETS.development(apiKeys.openai)
        : AI_CONFIG_PRESETS.localFirst();
        
    case 'production':
      if (!apiKeys.openai) {
        throw new Error('OpenAI API key required for production environment');
      }
      return AI_CONFIG_PRESETS.production(apiKeys.openai);
      
    case 'testing':
      return {
        defaultProvider: createWebLLMConfig('Llama-3.2-1B-Instruct-q4f32_1'),
        enableRetries: false,
        maxRetries: 0,
        timeout: 10000,
        validateOutput: true
      };
      
    default:
      throw new Error(`Unknown environment: ${env}`);
  }
};

/**
 * Configuration validator
 */
export const validateConfig = (config: AIRouterConfig): string[] => {
  const errors: string[] = [];
  
  // Check required fields
  if (!config.defaultProvider) {
    errors.push('defaultProvider is required');
  }
  
  // Validate provider configurations
  const allProviders = [
    config.defaultProvider,
    ...(config.fallbackProviders || [])
  ].filter(Boolean);
  
  for (const provider of allProviders) {
    if (!provider.provider) {
      errors.push('provider.provider is required');
    }
    
    if (!provider.model) {
      errors.push('provider.model is required');
    }
    
    if (provider.provider === 'openai' && !provider.apiKey) {
      errors.push('OpenAI provider requires apiKey');
    }
    
    if (provider.temperature !== undefined && 
        (provider.temperature < 0 || provider.temperature > 2)) {
      errors.push('temperature must be between 0 and 2');
    }
    
    if (provider.maxTokens !== undefined && provider.maxTokens < 1) {
      errors.push('maxTokens must be positive');
    }
  }
  
  return errors;
};

/**
 * Get optimal provider for specific task
 */
export const getOptimalProvider = (
  requirements: {
    speed?: 'fast' | 'medium' | 'slow';
    cost?: 'low' | 'medium' | 'high';
    quality?: 'basic' | 'good' | 'premium';
    privacy?: 'cloud' | 'local';
  },
  availableKeys: { openai?: string } = {}
): AIProviderConfig => {
  const { speed = 'medium', cost = 'medium', quality = 'good', privacy = 'cloud' } = requirements;
  
  // Local-only requirements
  if (privacy === 'local') {
    if (quality === 'premium') {
      return createWebLLMConfig('Llama-3.1-8B-Instruct-q4f32_1');
    } else if (quality === 'good') {
      return createWebLLMConfig('Llama-3.2-3B-Instruct-q4f32_1');
    } else {
      return createWebLLMConfig('Llama-3.2-1B-Instruct-q4f32_1');
    }
  }
  
  // Cloud providers
  if (availableKeys.openai) {
    if (speed === 'fast' || cost === 'low') {
      return createOpenAIConfig(availableKeys.openai, 'gpt-3.5-turbo');
    } else if (quality === 'premium') {
      return createOpenAIConfig(availableKeys.openai, 'gpt-4-turbo');
    } else {
      return createOpenAIConfig(availableKeys.openai, 'gpt-4');
    }
  }
  
  // Fallback to local
  return createWebLLMConfig('Llama-3.2-3B-Instruct-q4f32_1');
};