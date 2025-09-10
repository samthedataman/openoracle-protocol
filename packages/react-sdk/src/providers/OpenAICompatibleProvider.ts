import { BaseAIProvider } from './BaseAIProvider';
import { AIProvider, OpenAICompatibleConfig, AIRequest, AIResponse, AIError } from '../types/ai';

/**
 * OpenAI-Compatible Provider for Free LLM Services
 * 
 * Works with any service that implements OpenAI's Chat Completions API:
 * - Groq (free tier with Llama models)
 * - Together AI (free tier)
 * - Hugging Face Inference API
 * - LocalAI (self-hosted)
 * - Ollama (local with API server)
 * - OpenRouter (free models)
 * - And many more!
 */

// Popular free LLM service configurations
export const FREE_LLM_SERVICES = {
  // Groq - Ultra-fast inference
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    models: [
      'llama-3.1-70b-versatile',
      'llama-3.1-8b-instant',
      'llama-3.2-90b-text-preview',
      'mixtral-8x7b-32768',
      'gemma-7b-it',
      'llama3-70b-8192',
      'llama3-8b-8192'
    ],
    freeCredits: '$10/month',
    rateLimit: '30 requests/minute',
    description: 'Ultra-fast inference with generous free tier'
  },

  // Together AI - Multiple open models
  together: {
    baseUrl: 'https://api.together.xyz/v1',
    models: [
      'meta-llama/Llama-3-70b-chat-hf',
      'meta-llama/Llama-3-8b-chat-hf',
      'mistralai/Mixtral-8x7B-Instruct-v0.1',
      'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO',
      'microsoft/DialoGPT-medium',
      'togethercomputer/RedPajama-INCITE-Chat-3B-v1'
    ],
    freeCredits: '$25/month',
    rateLimit: 'Generous',
    description: 'Access to many open-source models'
  },

  // Hugging Face Inference API
  huggingface: {
    baseUrl: 'https://api-inference.huggingface.co/v1',
    models: [
      'microsoft/DialoGPT-large',
      'meta-llama/Llama-2-7b-chat-hf',
      'mistralai/Mistral-7B-Instruct-v0.1',
      'HuggingFaceH4/zephyr-7b-beta'
    ],
    freeCredits: 'Free with rate limits',
    rateLimit: '1000 requests/month',
    description: 'Direct access to Hugging Face models'
  },

  // OpenRouter - Free models only
  openrouter_free: {
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      'google/gemma-2-9b-it:free',
      'meta-llama/llama-3.1-8b-instruct:free',
      'microsoft/phi-3-medium-128k-instruct:free',
      'nousresearch/nous-capybara-7b:free'
    ],
    freeCredits: 'Completely free models',
    rateLimit: 'Per-model limits',
    description: 'Free tier models through OpenRouter'
  },

  // Ollama - Local deployment
  ollama: {
    baseUrl: 'http://localhost:11434/v1',
    models: [
      'llama3:latest',
      'llama3:8b',
      'codellama:latest',
      'mistral:latest',
      'phi3:latest',
      'gemma:latest'
    ],
    freeCredits: '100% free (local)',
    rateLimit: 'No limits',
    description: 'Self-hosted models via Ollama'
  },

  // LocalAI - Self-hosted OpenAI alternative
  localai: {
    baseUrl: 'http://localhost:8080/v1',
    models: [
      'gpt-3.5-turbo', // Usually mapped to local model
      'text-davinci-003',
      'code-davinci-002'
    ],
    freeCredits: '100% free (self-hosted)',
    rateLimit: 'No limits',
    description: 'Self-hosted LocalAI instance'
  }
} as const;

export type FreeLLMService = keyof typeof FREE_LLM_SERVICES;

export interface OpenAICompatibleConfig extends Record<string, any> {
  provider: AIProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  
  // Additional headers for specific services
  additionalHeaders?: Record<string, string>;
  
  // Service-specific settings
  serviceName?: FreeLLMService;
  validateSSL?: boolean;
}

export class OpenAICompatibleProvider extends BaseAIProvider {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private additionalHeaders: Record<string, string>;
  private serviceName?: FreeLLMService;
  private validateSSL: boolean;

  constructor(config: OpenAICompatibleConfig) {
    super(config);
    
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.defaultModel = config.model;
    this.additionalHeaders = config.additionalHeaders || {};
    this.serviceName = config.serviceName;
    this.validateSSL = config.validateSSL !== false; // Default to true
  }

  get provider(): AIProvider {
    return this.config.provider as AIProvider || 'openai-compatible';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(5000)
      });
      
      // Some services return 404 for /models endpoint but still work
      // So we also accept certain error codes as "available"
      return response.ok || response.status === 404;
    } catch (error) {
      console.warn(`OpenAI-compatible provider availability check failed:`, error);
      return false;
    }
  }

  private getHeaders(): Record<string, string> {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      ...this.additionalHeaders
    };

    // Service-specific headers
    if (this.serviceName === 'openrouter_free') {
      headers['HTTP-Referer'] = 'https://polypoll.app';
      headers['X-Title'] = 'PolyPoll - Free LLM Selection';
    }

    return headers;
  }

  protected async _makeRequest(request: AIRequest): Promise<AIResponse> {
    try {
      // Build request body compatible with OpenAI format
      const body: any = {
        model: request.model || this.defaultModel,
        messages: request.messages,
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? this.config.maxTokens ?? 1000
      };

      // Add response format if specified (for JSON mode)
      if (request.schema || request.messages.some(m => m.content.includes('JSON'))) {
        // Not all services support response_format, so we'll handle this gracefully
        try {
          body.response_format = { type: 'json_object' };
        } catch {
          // If service doesn't support it, add JSON instruction to prompt
          if (request.messages.length > 0) {
            const lastMessage = request.messages[request.messages.length - 1];
            if (lastMessage.role === 'user') {
              lastMessage.content += '\n\nPlease respond with valid JSON only.';
            }
          }
        }
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeout ?? 30000)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Provide helpful error messages for common issues
        let errorMessage = `API error: ${response.status} ${response.statusText}`;
        
        if (response.status === 401) {
          errorMessage = 'Invalid API key. Please check your credentials.';
        } else if (response.status === 429) {
          errorMessage = 'Rate limit exceeded. Try again later or upgrade your plan.';
        } else if (response.status === 503) {
          errorMessage = 'Service temporarily unavailable. Please try again.';
        }

        throw new AIError(
          errorMessage,
          this.provider,
          errorData.error?.code || 'HTTP_ERROR',
          errorData
        );
      }

      const data = await response.json();
      
      const choice = data.choices?.[0];
      if (!choice) {
        throw new AIError(
          'No response choice returned from API',
          this.provider,
          'NO_CHOICE'
        );
      }

      return {
        content: choice.message.content || choice.text || '',
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0
        } : undefined,
        model: data.model || request.model || this.defaultModel,
        provider: this.provider
      };

    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AIError(
          'Network error: Unable to reach the API endpoint. Check your internet connection and base URL.',
          this.provider,
          'NETWORK_ERROR',
          error
        );
      }

      throw new AIError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        this.provider,
        'REQUEST_ERROR',
        error
      );
    }
  }

  /**
   * Get recommended models for this service
   */
  getRecommendedModels(): string[] {
    if (this.serviceName && FREE_LLM_SERVICES[this.serviceName]) {
      return FREE_LLM_SERVICES[this.serviceName].models;
    }
    return [this.defaultModel];
  }

  /**
   * Get service information
   */
  getServiceInfo(): typeof FREE_LLM_SERVICES[FreeLLMService] | null {
    if (this.serviceName && FREE_LLM_SERVICES[this.serviceName]) {
      return FREE_LLM_SERVICES[this.serviceName];
    }
    return null;
  }

  /**
   * Test the connection with a simple request
   */
  async testConnection(): Promise<{ success: boolean; latency?: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      const testResponse = await this._makeRequest({
        messages: [{ role: 'user', content: 'Say "Hello" and nothing else.' }],
        model: this.defaultModel,
        temperature: 0,
        maxTokens: 10
      });

      const latency = Date.now() - startTime;
      
      return {
        success: true,
        latency
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// ============ FACTORY FUNCTIONS ============

/**
 * Create provider for Groq's free tier
 */
export function createGroqProvider(apiKey: string): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    provider: 'openai-compatible' as AIProvider,
    apiKey,
    baseUrl: FREE_LLM_SERVICES.groq.baseUrl,
    model: 'llama-3.1-70b-versatile', // Fast and capable
    serviceName: 'groq',
    temperature: 0.7,
    maxTokens: 1000
  });
}

/**
 * Create provider for Together AI's free tier
 */
export function createTogetherProvider(apiKey: string): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    provider: 'openai-compatible' as AIProvider,
    apiKey,
    baseUrl: FREE_LLM_SERVICES.together.baseUrl,
    model: 'meta-llama/Llama-3-8b-chat-hf',
    serviceName: 'together',
    temperature: 0.7,
    maxTokens: 1000
  });
}

/**
 * Create provider for OpenRouter's free models
 */
export function createOpenRouterFreeProvider(apiKey: string): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    provider: 'openai-compatible' as AIProvider,
    apiKey,
    baseUrl: FREE_LLM_SERVICES.openrouter_free.baseUrl,
    model: 'meta-llama/llama-3.1-8b-instruct:free',
    serviceName: 'openrouter_free',
    temperature: 0.7,
    maxTokens: 1000,
    additionalHeaders: {
      'HTTP-Referer': 'https://polypoll.app',
      'X-Title': 'PolyPoll - Free LLM Selection'
    }
  });
}

/**
 * Create provider for local Ollama instance
 */
export function createOllamaProvider(model: string = 'llama3:latest'): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    provider: 'openai-compatible' as AIProvider,
    apiKey: 'ollama', // Ollama doesn't need real API key
    baseUrl: 'http://localhost:11434/v1',
    model,
    serviceName: 'ollama',
    temperature: 0.7,
    maxTokens: 1000,
    validateSSL: false
  });
}

/**
 * Create provider for LocalAI instance
 */
export function createLocalAIProvider(baseUrl: string = 'http://localhost:8080', model: string = 'gpt-3.5-turbo'): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    provider: 'openai-compatible' as AIProvider,
    apiKey: 'local-ai', // LocalAI might not need real API key
    baseUrl: `${baseUrl}/v1`,
    model,
    serviceName: 'localai',
    temperature: 0.7,
    maxTokens: 1000,
    validateSSL: false
  });
}

/**
 * Auto-detect and create provider based on URL
 */
export function createProviderFromUrl(
  baseUrl: string, 
  apiKey: string, 
  model: string
): OpenAICompatibleProvider {
  // Auto-detect service based on URL
  let serviceName: FreeLLMService | undefined;
  
  if (baseUrl.includes('groq.com')) {
    serviceName = 'groq';
  } else if (baseUrl.includes('together.xyz')) {
    serviceName = 'together';
  } else if (baseUrl.includes('openrouter.ai')) {
    serviceName = 'openrouter_free';
  } else if (baseUrl.includes('localhost:11434')) {
    serviceName = 'ollama';
  } else if (baseUrl.includes('localhost:8080')) {
    serviceName = 'localai';
  }

  return new OpenAICompatibleProvider({
    provider: 'openai-compatible' as AIProvider,
    apiKey,
    baseUrl,
    model,
    serviceName,
    temperature: 0.7,
    maxTokens: 1000
  });
}

// Export service configurations for UI use
export { FREE_LLM_SERVICES };