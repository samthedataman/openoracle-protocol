import { 
  AIRoute, 
  AIProviderConfig, 
  AIRouterConfig, 
  AIError, 
  AIProvider 
} from '../types/ai';
import { BaseAIProvider } from '../providers/BaseAIProvider';
import { OpenAIProvider } from '../providers/OpenAIProvider';
import { WebLLMProvider } from '../providers/WebLLMProvider';

export class AIRouter {
  private config: AIRouterConfig;
  private providers: Map<string, BaseAIProvider> = new Map();
  
  constructor(config: AIRouterConfig) {
    this.config = config;
    this.initializeProviders();
  }
  
  private initializeProviders(): void {
    // Initialize default provider
    this.addProvider(this.config.defaultProvider);
    
    // Initialize fallback providers
    if (this.config.fallbackProviders) {
      for (const provider of this.config.fallbackProviders) {
        this.addProvider(provider);
      }
    }
  }
  
  private addProvider(config: AIProviderConfig): void {
    const key = `${config.provider}-${config.model}`;
    
    if (this.providers.has(key)) {
      return; // Provider already exists
    }
    
    let provider: BaseAIProvider;
    
    switch (config.provider) {
      case 'openai':
        provider = new OpenAIProvider(config as any);
        break;
      case 'web-llm':
      case 'local-llm':
        provider = new WebLLMProvider(config as any);
        break;
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
    
    this.providers.set(key, provider);
  }
  
  /**
   * Execute a route with automatic fallback
   */
  async execute<TInput, TOutput>(
    route: AIRoute<TInput, TOutput>,
    input: TInput,
    preferredProvider?: AIProviderConfig
  ): Promise<TOutput> {
    const providers = this.getProvidersInOrder(preferredProvider);
    let lastError: AIError | null = null;
    
    for (const provider of providers) {
      try {
        // Check if provider is available
        const isAvailable = await provider.isAvailable();
        if (!isAvailable) {
          continue;
        }
        
        // Execute with retry logic
        return await this.executeWithRetries(provider, route, input);
        
      } catch (error) {
        lastError = error instanceof AIError ? error : new AIError(
          error instanceof Error ? error.message : 'Unknown error',
          provider.provider,
          'EXECUTION_ERROR',
          error
        );
        
        console.warn(`Provider ${provider.provider} failed:`, lastError.message);
        
        // Continue to next provider unless it's a validation error
        if (lastError instanceof AIError && lastError.code === 'VALIDATION_ERROR') {
          throw lastError; // Don't retry validation errors
        }
      }
    }
    
    // All providers failed
    throw lastError || new AIError(
      'All providers failed and no fallback available',
      'unknown' as AIProvider,
      'NO_PROVIDERS'
    );
  }
  
  private async executeWithRetries<TInput, TOutput>(
    provider: BaseAIProvider,
    route: AIRoute<TInput, TOutput>,
    input: TInput
  ): Promise<TOutput> {
    const maxRetries = this.config.maxRetries ?? 3;
    let attempt = 0;
    
    while (attempt <= maxRetries) {
      try {
        return await provider.execute(route, input);
      } catch (error) {
        attempt++;
        
        if (attempt > maxRetries) {
          throw error;
        }
        
        // Don't retry validation errors or rate limits immediately
        if (error instanceof AIError && 
            (error.code === 'VALIDATION_ERROR' || error.code === 'RATE_LIMIT')) {
          throw error;
        }
        
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('Unexpected retry loop exit');
  }
  
  private getProvidersInOrder(preferredProvider?: AIProviderConfig): BaseAIProvider[] {
    const providers: BaseAIProvider[] = [];
    
    // Add preferred provider first
    if (preferredProvider) {
      const key = `${preferredProvider.provider}-${preferredProvider.model}`;
      const provider = this.providers.get(key);
      if (provider) {
        providers.push(provider);
      }
    }
    
    // Add default provider if not already added
    const defaultKey = `${this.config.defaultProvider.provider}-${this.config.defaultProvider.model}`;
    const defaultProvider = this.providers.get(defaultKey);
    if (defaultProvider && !providers.includes(defaultProvider)) {
      providers.push(defaultProvider);
    }
    
    // Add fallback providers
    if (this.config.fallbackProviders) {
      for (const fallbackConfig of this.config.fallbackProviders) {
        const key = `${fallbackConfig.provider}-${fallbackConfig.model}`;
        const provider = this.providers.get(key);
        if (provider && !providers.includes(provider)) {
          providers.push(provider);
        }
      }
    }
    
    return providers;
  }
  
  /**
   * Check if a specific provider is available
   */
  async isProviderAvailable(providerType: AIProvider): Promise<boolean> {
    for (const [key, provider] of this.providers) {
      if (provider.provider === providerType) {
        return await provider.isAvailable();
      }
    }
    return false;
  }
  
  /**
   * Get available providers
   */
  async getAvailableProviders(): Promise<AIProvider[]> {
    const available: AIProvider[] = [];
    
    for (const [key, provider] of this.providers) {
      if (await provider.isAvailable()) {
        available.push(provider.provider);
      }
    }
    
    return available;
  }
  
  /**
   * Update router configuration
   */
  updateConfig(newConfig: Partial<AIRouterConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Reinitialize providers if needed
    if (newConfig.defaultProvider || newConfig.fallbackProviders) {
      this.providers.clear();
      this.initializeProviders();
    }
  }
  
  /**
   * Add a new provider at runtime
   */
  addProviderConfig(config: AIProviderConfig): void {
    this.addProvider(config);
  }
  
  /**
   * Remove a provider
   */
  removeProvider(provider: AIProvider, model?: string): void {
    const keysToRemove: string[] = [];
    
    for (const [key, providerInstance] of this.providers) {
      if (providerInstance.provider === provider) {
        if (!model || key.includes(model)) {
          keysToRemove.push(key);
        }
      }
    }
    
    for (const key of keysToRemove) {
      this.providers.delete(key);
    }
  }
  
  /**
   * Test all providers
   */
  async testAllProviders(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [key, provider] of this.providers) {
      try {
        results[key] = await provider.test();
      } catch (error) {
        results[key] = false;
      }
    }
    
    return results;
  }
  
  /**
   * Cleanup resources (especially for WebLLM)
   */
  async cleanup(): Promise<void> {
    for (const [key, provider] of this.providers) {
      if (provider instanceof WebLLMProvider) {
        await provider.cleanup();
      }
    }
  }
}