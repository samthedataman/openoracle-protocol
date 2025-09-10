import { BaseAIProvider } from './BaseAIProvider';
import { AIProvider, LocalLLMConfig, AIRequest, AIResponse, AIError } from '../types/ai';

// Dynamic import for optional dependency
let WebLLM: any = null;
let MLCEngine: any = null;

// Try to load web-llm package
const loadWebLLM = async () => {
  if (WebLLM) return WebLLM;
  
  try {
    WebLLM = await import('@mlc-ai/web-llm');
    MLCEngine = WebLLM.CreateMLCEngine || WebLLM.MLCEngine;
    return WebLLM;
  } catch (error) {
    throw new AIError(
      'web-llm package not found. Install with: npm install @mlc-ai/web-llm',
      'web-llm',
      'DEPENDENCY_MISSING',
      error
    );
  }
};

// Supported models configuration
const SUPPORTED_MODELS = {
  'Llama-3.2-3B-Instruct-q4f32_1': {
    model_id: 'Llama-3.2-3B-Instruct-q4f32_1',
    model_url: 'https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f32_1-MLC',
    required_features: ['shader-f16']
  },
  'Llama-3.2-1B-Instruct-q4f32_1': {
    model_id: 'Llama-3.2-1B-Instruct-q4f32_1', 
    model_url: 'https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f32_1-MLC',
    required_features: ['shader-f16']
  },
  'Llama-3.1-8B-Instruct-q4f32_1': {
    model_id: 'Llama-3.1-8B-Instruct-q4f32_1',
    model_url: 'https://huggingface.co/mlc-ai/Llama-3.1-8B-Instruct-q4f32_1-MLC', 
    required_features: ['shader-f16']
  },
  'Phi-3.5-mini-instruct-q4f16_1': {
    model_id: 'Phi-3.5-mini-instruct-q4f16_1',
    model_url: 'https://huggingface.co/mlc-ai/Phi-3.5-mini-instruct-q4f16_1-MLC',
    required_features: ['shader-f16']
  }
};

export class WebLLMProvider extends BaseAIProvider {
  private engine: any = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  
  constructor(config: LocalLLMConfig) {
    super(config);
  }
  
  get provider(): AIProvider {
    return this.config.provider as AIProvider;
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      // Check if WebGPU is available
      if (!navigator.gpu) {
        return false;
      }
      
      // Check if web-llm package can be loaded
      await loadWebLLM();
      
      // Check GPU capabilities
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return false;
      
      const device = await adapter.requestDevice();
      return !!device;
    } catch {
      return false;
    }
  }
  
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = this._doInitialize();
    await this.initPromise;
    this.isInitialized = true;
  }
  
  private async _doInitialize(): Promise<void> {
    try {
      await loadWebLLM();
      
      const modelConfig = SUPPORTED_MODELS[this.config.model as keyof typeof SUPPORTED_MODELS];
      if (!modelConfig) {
        throw new AIError(
          `Unsupported model: ${this.config.model}. Supported models: ${Object.keys(SUPPORTED_MODELS).join(', ')}`,
          this.provider,
          'UNSUPPORTED_MODEL'
        );
      }
      
      // Initialize MLC Engine with progress callback
      this.engine = await MLCEngine({
        model: modelConfig.model_id,
        model_url: this.config.modelUrl || modelConfig.model_url,
        wasmUrl: this.config.wasmPath,
        
        // Progress callback for model loading
        progressCallback: (progress: any) => {
          if (progress.text) {
            console.log(`[WebLLM] ${progress.text}`);
          }
          if (progress.progress !== undefined) {
            console.log(`[WebLLM] Loading progress: ${(progress.progress * 100).toFixed(1)}%`);
          }
        }
      });
      
      console.log(`[WebLLM] Model ${this.config.model} initialized successfully`);
      
    } catch (error) {
      throw new AIError(
        `Failed to initialize WebLLM: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.provider,
        'INIT_ERROR',
        error
      );
    }
  }
  
  protected async _makeRequest(request: AIRequest): Promise<AIResponse> {
    try {
      await this.initialize();
      
      if (!this.engine) {
        throw new AIError('WebLLM engine not initialized', this.provider, 'NOT_INITIALIZED');
      }
      
      // Format messages for Llama-3 chat template
      const formattedPrompt = this.formatMessagesForLlama(request.messages);
      
      // Add JSON instruction if schema is provided
      let prompt = formattedPrompt;
      if (request.schema) {
        prompt += '\n\nPlease respond with valid JSON only. Do not include any additional text or explanation.';
      }
      
      // Generate response
      const response = await this.engine.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? this.config.maxTokens ?? 2000,
        stream: false
      });
      
      const choice = response.choices?.[0];
      if (!choice) {
        throw new AIError('No response choice returned from WebLLM', this.provider, 'NO_CHOICE');
      }
      
      return {
        content: choice.message.content,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens || 0,
          completionTokens: response.usage.completion_tokens || 0,
          totalTokens: response.usage.total_tokens || 0
        } : undefined,
        model: this.config.model,
        provider: this.provider
      };
      
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }
      
      throw new AIError(
        error instanceof Error ? error.message : 'Unknown WebLLM error',
        this.provider,
        'REQUEST_ERROR',
        error
      );
    }
  }
  
  private formatMessagesForLlama(messages: any[]): string {
    let formatted = '';
    
    for (const message of messages) {
      switch (message.role) {
        case 'system':
          formatted += `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${message.content}<|eot_id|>`;
          break;
        case 'user':
          formatted += `<|start_header_id|>user<|end_header_id|>\n\n${message.content}<|eot_id|>`;
          break;
        case 'assistant':
          formatted += `<|start_header_id|>assistant<|end_header_id|>\n\n${message.content}<|eot_id|>`;
          break;
      }
    }
    
    // Add assistant start token for response
    formatted += '<|start_header_id|>assistant<|end_header_id|>\n\n';
    
    return formatted;
  }
  
  /**
   * Get model loading progress
   */
  getLoadingProgress(): number {
    // This would need to be implemented based on web-llm's progress reporting
    return this.isInitialized ? 100 : 0;
  }
  
  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.engine) {
      try {
        await this.engine.unload();
        this.engine = null;
        this.isInitialized = false;
        this.initPromise = null;
      } catch (error) {
        console.warn('Error cleaning up WebLLM engine:', error);
      }
    }
  }
  
  /**
   * Check GPU memory usage
   */
  async getGPUMemoryInfo(): Promise<{ used: number; total: number } | null> {
    try {
      if (!navigator.gpu) return null;
      
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return null;
      
      // This is a rough estimation - actual implementation would depend on WebLLM's memory reporting
      return {
        used: this.isInitialized ? 2000 : 0, // MB
        total: 8000 // MB - typical GPU memory
      };
    } catch {
      return null;
    }
  }
}

// Export utility functions
export const getAvailableWebLLMModels = () => {
  return Object.keys(SUPPORTED_MODELS);
};

export const isWebLLMSupported = async (): Promise<boolean> => {
  try {
    if (!navigator.gpu) return false;
    
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    
    // Check for required features
    const device = await adapter.requestDevice();
    return !!device;
  } catch {
    return false;
  }
};

export const getRecommendedWebLLMModel = (): string => {
  // Recommend based on estimated performance/size trade-off
  return 'Llama-3.2-1B-Instruct-q4f32_1'; // Fastest, smallest
};