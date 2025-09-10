/**
 * Unified LLM Provider Interface for OpenOracle Node SDK
 * 
 * Provides a consistent interface for interacting with different LLM providers:
 * - OpenAI (GPT-4, GPT-3.5-turbo, etc.)
 * - OpenRouter (Multiple models via single API)
 * - WebLLM (Local browser-based models)
 * - Anthropic Claude (via OpenRouter)
 * 
 * This module enables dynamic routing between providers based on availability,
 * cost, performance, and specific use case requirements.
 */

import axios, { AxiosResponse } from 'axios'
import { EventEmitter } from 'events'

// ============ Core Types ============

export enum LLMProvider {
  OPENAI = 'openai',
  OPENROUTER = 'openrouter',
  WEBLLM = 'webllm',
  ANTHROPIC = 'anthropic'
}

export enum MessageRole {
  SYSTEM = 'system',
  USER = 'user', 
  ASSISTANT = 'assistant'
}

export interface ChatMessage {
  role: MessageRole
  content: string
  name?: string
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  costUsd?: number
}

export interface LLMResponse {
  content: string
  model: string
  provider: LLMProvider
  usage?: TokenUsage
  responseTimeMs?: number
  metadata?: Record<string, any>
}

export interface LLMRequest {
  messages: ChatMessage[]
  model: string
  temperature?: number
  maxTokens?: number
  responseFormat?: { type: string; schema?: string }
  tools?: Array<Record<string, any>>
  stream?: boolean
  
  // Provider-specific options
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stop?: string[]
}

// ============ Base Provider Interface ============

export abstract class BaseLLMProvider extends EventEmitter {
  protected config: Record<string, any>
  protected provider: LLMProvider

  constructor(config: Record<string, any>) {
    super()
    this.config = config
    this.provider = this.getProvider()
  }

  abstract getProvider(): LLMProvider
  abstract isAvailable(): Promise<boolean>
  abstract generate(request: LLMRequest): Promise<LLMResponse>
  abstract streamGenerate(request: LLMRequest): AsyncGenerator<string, void, unknown>
  abstract getSupportedModels(): string[]
  abstract estimateCost(request: LLMRequest): number | null
}

// ============ OpenAI Provider ============

export class OpenAIProvider extends BaseLLMProvider {
  private static readonly MODELS = {
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-3.5-turbo': { input: 0.001, output: 0.002 }
  }

  private apiKey: string
  private baseUrl: string
  private defaultModel: string

  constructor(config: Record<string, any>) {
    super(config)
    
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1'
    this.defaultModel = config.defaultModel || 'gpt-4o-mini'

    if (!this.apiKey) {
      throw new Error('OpenAI API key is required')
    }
  }

  getProvider(): LLMProvider {
    return LLMProvider.OPENAI
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      })
      return response.status === 200
    } catch (error) {
      console.warn('OpenAI availability check failed:', error)
      return false
    }
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now()

    try {
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }

      // Convert messages to OpenAI format
      const messages = request.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      const payload: any = {
        model: request.model || this.defaultModel,
        messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 800
      }

      // Add optional parameters
      if (request.responseFormat) {
        payload.response_format = request.responseFormat
      }
      if (request.topP !== undefined) {
        payload.top_p = request.topP
      }
      if (request.frequencyPenalty !== undefined) {
        payload.frequency_penalty = request.frequencyPenalty
      }
      if (request.presencePenalty !== undefined) {
        payload.presence_penalty = request.presencePenalty
      }
      if (request.stop) {
        payload.stop = request.stop
      }

      const response: AxiosResponse = await axios.post(
        `${this.baseUrl}/chat/completions`,
        payload,
        { headers, timeout: 60000 }
      )

      if (response.status !== 200) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
      }

      const data = response.data
      const choice = data.choices[0]
      const usageData = data.usage || {}

      // Calculate cost
      const modelName = data.model
      let cost: number | undefined
      if (modelName in OpenAIProvider.MODELS && usageData) {
        const pricing = OpenAIProvider.MODELS[modelName as keyof typeof OpenAIProvider.MODELS]
        const promptCost = (usageData.prompt_tokens || 0) * pricing.input / 1000
        const completionCost = (usageData.completion_tokens || 0) * pricing.output / 1000
        cost = promptCost + completionCost
      }

      const usage: TokenUsage = {
        promptTokens: usageData.prompt_tokens || 0,
        completionTokens: usageData.completion_tokens || 0,
        totalTokens: usageData.total_tokens || 0,
        costUsd: cost
      }

      return {
        content: choice.message.content,
        model: data.model,
        provider: this.provider,
        usage,
        responseTimeMs: Date.now() - startTime
      }

    } catch (error) {
      console.error('OpenAI generation failed:', error)
      throw error
    }
  }

  async *streamGenerate(request: LLMRequest): AsyncGenerator<string, void, unknown> {
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    }

    const messages = request.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    const payload = {
      model: request.model || this.defaultModel,
      messages,
      temperature: request.temperature || 0.7,
      max_tokens: request.maxTokens || 800,
      stream: true
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        payload,
        { 
          headers, 
          timeout: 120000,
          responseType: 'stream'
        }
      )

      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            
            if (data === '[DONE]') {
              return
            }

            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta
              
              if (delta?.content) {
                yield delta.content
              }
            } catch (parseError) {
              // Skip malformed JSON
              continue
            }
          }
        }
      }
    } catch (error) {
      console.error('OpenAI streaming failed:', error)
      throw error
    }
  }

  getSupportedModels(): string[] {
    return Object.keys(OpenAIProvider.MODELS)
  }

  estimateCost(request: LLMRequest): number | null {
    const model = request.model || this.defaultModel
    if (!(model in OpenAIProvider.MODELS)) {
      return null
    }

    const pricing = OpenAIProvider.MODELS[model as keyof typeof OpenAIProvider.MODELS]

    // Estimate tokens (rough approximation: 4 chars = 1 token)
    const totalChars = request.messages.reduce((sum, msg) => sum + msg.content.length, 0)
    const promptTokens = Math.ceil(totalChars / 4)
    const completionTokens = request.maxTokens || 800

    const promptCost = promptTokens * pricing.input / 1000
    const completionCost = completionTokens * pricing.output / 1000

    return promptCost + completionCost
  }
}

// ============ OpenRouter Provider ============

export class OpenRouterProvider extends BaseLLMProvider {
  private apiKey: string
  private baseUrl: string
  private defaultModel: string
  private httpReferer: string
  private xTitle: string

  constructor(config: Record<string, any>) {
    super(config)
    
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1'
    this.defaultModel = config.defaultModel || 'openai/gpt-4o-mini'
    this.httpReferer = config.httpReferer || 'https://polypoll.app'
    this.xTitle = config.xTitle || 'PolyPoll - Viral Prediction Markets'

    if (!this.apiKey) {
      throw new Error('OpenRouter API key is required')
    }
  }

  getProvider(): LLMProvider {
    return LLMProvider.OPENROUTER
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': this.httpReferer,
          'X-Title': this.xTitle
        },
        timeout: 5000
      })
      return response.status === 200
    } catch (error) {
      console.warn('OpenRouter availability check failed:', error)
      return false
    }
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now()

    try {
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': this.httpReferer,
        'X-Title': this.xTitle
      }

      const messages = request.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      const payload: any = {
        model: request.model || this.defaultModel,
        messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 800
      }

      // Add optional parameters
      if (request.responseFormat) {
        payload.response_format = request.responseFormat
      }
      if (request.topP !== undefined) {
        payload.top_p = request.topP
      }
      if (request.frequencyPenalty !== undefined) {
        payload.frequency_penalty = request.frequencyPenalty
      }
      if (request.presencePenalty !== undefined) {
        payload.presence_penalty = request.presencePenalty
      }
      if (request.stop) {
        payload.stop = request.stop
      }

      const response: AxiosResponse = await axios.post(
        `${this.baseUrl}/chat/completions`,
        payload,
        { headers, timeout: 60000 }
      )

      if (response.status !== 200) {
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`)
      }

      const data = response.data
      const choice = data.choices[0]
      const usageData = data.usage || {}

      const usage: TokenUsage = {
        promptTokens: usageData.prompt_tokens || 0,
        completionTokens: usageData.completion_tokens || 0,
        totalTokens: usageData.total_tokens || 0,
        // OpenRouter doesn't provide cost in response
        costUsd: undefined
      }

      return {
        content: choice.message.content,
        model: data.model,
        provider: this.provider,
        usage,
        responseTimeMs: Date.now() - startTime
      }

    } catch (error) {
      console.error('OpenRouter generation failed:', error)
      throw error
    }
  }

  async *streamGenerate(request: LLMRequest): AsyncGenerator<string, void, unknown> {
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': this.httpReferer,
      'X-Title': this.xTitle
    }

    const messages = request.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    const payload = {
      model: request.model || this.defaultModel,
      messages,
      temperature: request.temperature || 0.7,
      max_tokens: request.maxTokens || 800,
      stream: true
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        payload,
        { 
          headers, 
          timeout: 120000,
          responseType: 'stream'
        }
      )

      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            
            if (data === '[DONE]') {
              return
            }

            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta
              
              if (delta?.content) {
                yield delta.content
              }
            } catch (parseError) {
              continue
            }
          }
        }
      }
    } catch (error) {
      console.error('OpenRouter streaming failed:', error)
      throw error
    }
  }

  getSupportedModels(): string[] {
    return [
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'openai/gpt-4-turbo',
      'anthropic/claude-3.5-sonnet',
      'anthropic/claude-3-haiku',
      'meta-llama/llama-3.1-405b-instruct',
      'meta-llama/llama-3.1-70b-instruct',
      'meta-llama/llama-3.1-8b-instruct',
      'google/gemini-pro-1.5',
      'cohere/command-r-plus',
      'mistralai/mistral-7b-instruct',
      'qwen/qwen-2-7b-instruct'
    ]
  }

  estimateCost(request: LLMRequest): number | null {
    // OpenRouter pricing varies by model - would need to fetch from API
    return null
  }
}

// ============ WebLLM Provider ============

export class WebLLMProvider extends BaseLLMProvider {
  private static readonly SUPPORTED_MODELS = [
    'Llama-3.2-3B-Instruct-q4f32_1',
    'Llama-3.2-1B-Instruct-q4f32_1',
    'Llama-3.1-8B-Instruct-q4f32_1',
    'Phi-3.5-mini-instruct-q4f16_1',
    'TinyLlama-1.1B-Chat-v1.0-q4f16_1',
    'SmolLM2-1.7B-Instruct-q4f16_1',
    'Qwen2.5-3B-Instruct-q4f16_1'
  ]

  private defaultModel: string

  constructor(config: Record<string, any>) {
    super(config)
    this.defaultModel = config.defaultModel || 'Llama-3.2-1B-Instruct-q4f32_1'
  }

  getProvider(): LLMProvider {
    return LLMProvider.WEBLLM
  }

  async isAvailable(): Promise<boolean> {
    // WebLLM runs in browser, not available in Node.js
    return false
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    throw new Error('WebLLM only works in browser environment')
  }

  async *streamGenerate(request: LLMRequest): AsyncGenerator<string, void, unknown> {
    throw new Error('WebLLM only works in browser environment')
    // Make this a generator function
    yield
  }

  getSupportedModels(): string[] {
    return [...WebLLMProvider.SUPPORTED_MODELS]
  }

  estimateCost(request: LLMRequest): number | null {
    // WebLLM is free (local compute)
    return 0
  }
}

// ============ Provider Configuration ============

export interface ProviderConfig {
  provider: LLMProvider
  config: Record<string, any>
  priority: number  // Higher = preferred
  maxTokens?: number
  enabled: boolean
}

// ============ LLM Router ============

export class LLMRouter extends EventEmitter {
  private providers: Map<LLMProvider, BaseLLMProvider> = new Map()
  private providerConfigs: ProviderConfig[]

  constructor(providers: ProviderConfig[]) {
    super()
    this.providerConfigs = providers

    // Initialize providers
    for (const providerConfig of providers) {
      if (!providerConfig.enabled) {
        continue
      }

      const ProviderClass = this.getProviderClass(providerConfig.provider)
      try {
        const provider = new ProviderClass(providerConfig.config)
        this.providers.set(providerConfig.provider, provider)
        console.log(`Initialized ${providerConfig.provider} provider`)
      } catch (error) {
        console.error(`Failed to initialize ${providerConfig.provider}:`, error)
      }
    }
  }

  private getProviderClass(provider: LLMProvider): typeof BaseLLMProvider {
    const mapping = {
      [LLMProvider.OPENAI]: OpenAIProvider,
      [LLMProvider.OPENROUTER]: OpenRouterProvider,
      [LLMProvider.WEBLLM]: WebLLMProvider
    }

    const ProviderClass = mapping[provider]
    if (!ProviderClass) {
      throw new Error(`Unsupported provider: ${provider}`)
    }

    return ProviderClass
  }

  async getAvailableProviders(): Promise<LLMProvider[]> {
    const available: LLMProvider[] = []

    for (const [providerType, provider] of this.providers) {
      try {
        if (await provider.isAvailable()) {
          available.push(providerType)
        }
      } catch (error) {
        console.warn(`Availability check failed for ${providerType}:`, error)
      }
    }

    return available
  }

  async routeRequest(
    request: LLMRequest,
    preferredProvider?: LLMProvider,
    fallback: boolean = true
  ): Promise<LLMResponse> {
    // Try preferred provider first
    if (preferredProvider && this.providers.has(preferredProvider)) {
      try {
        const provider = this.providers.get(preferredProvider)!
        if (await provider.isAvailable()) {
          console.log(`Using preferred provider: ${preferredProvider}`)
          return await provider.generate(request)
        }
      } catch (error) {
        console.warn(`Preferred provider ${preferredProvider} failed:`, error)
        if (!fallback) {
          throw error
        }
      }
    }

    // Try providers by priority
    const availableProviders = await this.getAvailableProviders()

    if (availableProviders.length === 0) {
      throw new Error('No LLM providers are currently available')
    }

    // Sort by priority from config
    const providerPriorities = new Map<LLMProvider, number>()
    for (const pc of this.providerConfigs) {
      if (pc.enabled) {
        providerPriorities.set(pc.provider, pc.priority)
      }
    }

    const sortedProviders = availableProviders.sort((a, b) => {
      const priorityA = providerPriorities.get(a) || 0
      const priorityB = providerPriorities.get(b) || 0
      return priorityB - priorityA  // Higher priority first
    })

    let lastError: Error | null = null
    for (const providerType of sortedProviders) {
      try {
        const provider = this.providers.get(providerType)!
        console.log(`Trying provider: ${providerType}`)
        return await provider.generate(request)
      } catch (error) {
        console.warn(`Provider ${providerType} failed:`, error)
        lastError = error as Error
        continue
      }
    }

    // All providers failed
    throw new Error(`All providers failed. Last error: ${lastError?.message}`)
  }

  async *streamRequest(
    request: LLMRequest,
    preferredProvider?: LLMProvider
  ): AsyncGenerator<string, void, unknown> {
    // Select provider (similar logic to routeRequest)
    let provider: BaseLLMProvider | null = null

    if (preferredProvider && this.providers.has(preferredProvider)) {
      try {
        const candidate = this.providers.get(preferredProvider)!
        if (await candidate.isAvailable()) {
          provider = candidate
        }
      } catch (error) {
        // Continue to fallback
      }
    }

    if (!provider) {
      const available = await this.getAvailableProviders()
      if (available.length > 0) {
        provider = this.providers.get(available[0])!
      }
    }

    if (!provider) {
      throw new Error('No providers available for streaming')
    }

    yield* provider.streamGenerate(request)
  }

  getProvider(providerType: LLMProvider): BaseLLMProvider | undefined {
    return this.providers.get(providerType)
  }

  getSupportedModels(providerType?: LLMProvider): Record<LLMProvider, string[]> {
    if (providerType) {
      const provider = this.providers.get(providerType)
      if (provider) {
        return { [providerType]: provider.getSupportedModels() }
      }
      return {}
    }

    const result: Record<LLMProvider, string[]> = {} as any
    for (const [ptype, provider] of this.providers) {
      result[ptype] = provider.getSupportedModels()
    }
    return result
  }
}

// ============ Factory Functions ============

export function createOpenAIProvider(apiKey: string, options: Record<string, any> = {}): OpenAIProvider {
  return new OpenAIProvider({ apiKey, ...options })
}

export function createOpenRouterProvider(apiKey: string, options: Record<string, any> = {}): OpenRouterProvider {
  return new OpenRouterProvider({ apiKey, ...options })
}

export function createWebLLMProvider(options: Record<string, any> = {}): WebLLMProvider {
  return new WebLLMProvider(options)
}

export function createLLMRouter(config: {
  openaiKey?: string
  openrouterKey?: string
  enableWebllm?: boolean
}): LLMRouter {
  const providers: ProviderConfig[] = []

  // Add OpenAI if key provided
  if (config.openaiKey) {
    providers.push({
      provider: LLMProvider.OPENAI,
      config: { apiKey: config.openaiKey },
      priority: 3,  // High priority
      enabled: true
    })
  }

  // Add OpenRouter if key provided
  if (config.openrouterKey) {
    providers.push({
      provider: LLMProvider.OPENROUTER,
      config: { apiKey: config.openrouterKey },
      priority: 2,  // Medium priority
      enabled: true
    })
  }

  // Add WebLLM if enabled (client-side only)
  if (config.enableWebllm) {
    providers.push({
      provider: LLMProvider.WEBLLM,
      config: {},
      priority: 1,  // Low priority (slower)
      enabled: true
    })
  }

  if (providers.length === 0) {
    throw new Error('At least one provider must be configured')
  }

  return new LLMRouter(providers)
}

// ============ Convenience Functions ============

export async function generateResponse(
  messages: ChatMessage[],
  router: LLMRouter,
  options: {
    model?: string
    temperature?: number
    maxTokens?: number
    responseFormat?: { type: string; schema?: string }
    preferredProvider?: LLMProvider
  } = {}
): Promise<LLMResponse> {
  const request: LLMRequest = {
    messages,
    model: options.model || 'gpt-4o-mini',
    temperature: options.temperature || 0.7,
    maxTokens: options.maxTokens || 800,
    responseFormat: options.responseFormat
  }

  return await router.routeRequest(request, options.preferredProvider)
}

export async function generateJsonResponse(
  messages: ChatMessage[],
  router: LLMRouter,
  options: {
    model?: string
    temperature?: number
    maxTokens?: number
    preferredProvider?: LLMProvider
  } = {}
): Promise<Record<string, any>> {
  // Add JSON instruction to last user message
  if (messages.length > 0 && messages[messages.length - 1].role === MessageRole.USER) {
    messages[messages.length - 1].content += '\n\nRespond with valid JSON only.'
  }

  const request: LLMRequest = {
    messages,
    model: options.model || 'gpt-4o-mini',
    temperature: options.temperature || 0.7,
    maxTokens: options.maxTokens || 800,
    responseFormat: { type: 'json_object' }
  }

  const response = await router.routeRequest(request, options.preferredProvider)

  try {
    return JSON.parse(response.content)
  } catch (error) {
    console.error('Failed to parse JSON response:', response.content)
    throw new Error(`Invalid JSON response: ${error}`)
  }
}