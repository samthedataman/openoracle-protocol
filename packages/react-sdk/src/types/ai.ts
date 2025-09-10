import { z } from 'zod';

// AI Provider Types
export type AIProvider = 'openai' | 'anthropic' | 'local-llm' | 'web-llm';

// Base AI Configuration
export interface AIConfig {
  provider: AIProvider;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

// OpenAI Configuration
export interface OpenAIConfig extends AIConfig {
  provider: 'openai';
  model: 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo' | string;
  apiKey: string;
}

// Anthropic Configuration
export interface AnthropicConfig extends AIConfig {
  provider: 'anthropic';
  model: 'claude-3-opus' | 'claude-3-sonnet' | 'claude-3-haiku' | string;
  apiKey: string;
}

// Local LLM Configuration (via web-llm)
export interface LocalLLMConfig extends AIConfig {
  provider: 'local-llm' | 'web-llm';
  model: 'Llama-3.2-3B-Instruct-q4f32_1' | 'Llama-3.2-1B-Instruct-q4f32_1' | string;
  modelUrl?: string;
  wasmPath?: string;
}

// Union type for all configs
export type AIProviderConfig = OpenAIConfig | AnthropicConfig | LocalLLMConfig;

// Message Types
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Request/Response Types
export interface AIRequest {
  messages: AIMessage[];
  schema?: z.ZodSchema;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AIResponse<T = any> {
  content: string;
  parsed?: T;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  provider: AIProvider;
}

// Error Types
export class AIError extends Error {
  constructor(
    message: string,
    public provider: AIProvider,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export class AIValidationError extends AIError {
  constructor(
    message: string,
    provider: AIProvider,
    public validationErrors: z.ZodError
  ) {
    super(message, provider, 'VALIDATION_ERROR', validationErrors);
    this.name = 'AIValidationError';
  }
}

// Route Definition Types
export interface AIRoute<TInput = any, TOutput = any> {
  path: string;
  description: string;
  inputSchema: z.ZodSchema<TInput>;
  outputSchema: z.ZodSchema<TOutput>;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  examples?: Array<{
    input: TInput;
    output: TOutput;
    description?: string;
  }>;
}

// Router Types
export interface AIRouterConfig {
  defaultProvider: AIProviderConfig;
  fallbackProviders?: AIProviderConfig[];
  enableRetries?: boolean;
  maxRetries?: number;
  timeout?: number;
  validateOutput?: boolean;
}

// Hook Types
export interface UseAIRouterOptions {
  route: AIRoute;
  provider?: AIProviderConfig;
  onSuccess?: (response: AIResponse) => void;
  onError?: (error: AIError) => void;
  retryCount?: number;
}

export interface UseAIRouterResult<TOutput> {
  execute: (input: any) => Promise<TOutput>;
  isLoading: boolean;
  error: AIError | null;
  response: AIResponse<TOutput> | null;
  retry: () => Promise<TOutput | null>;
}

// Context Types
export interface AIRouterContextValue {
  config: AIRouterConfig;
  updateConfig: (config: Partial<AIRouterConfig>) => void;
  executeRoute: <TInput, TOutput>(
    route: AIRoute<TInput, TOutput>,
    input: TInput,
    provider?: AIProviderConfig
  ) => Promise<TOutput>;
  isProviderAvailable: (provider: AIProvider) => boolean;
}