import { BaseAIProvider } from './BaseAIProvider';
import { AIProvider, OpenAIConfig, AIRequest, AIResponse, AIError } from '../types/ai';

export class OpenAIProvider extends BaseAIProvider {
  private baseUrl: string;
  private headers: Record<string, string>;
  
  constructor(config: OpenAIConfig) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    };
  }
  
  get provider(): AIProvider {
    return 'openai';
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: this.headers,
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  protected async _makeRequest(request: AIRequest): Promise<AIResponse> {
    try {
      const body: any = {
        model: this.config.model,
        messages: request.messages,
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? this.config.maxTokens ?? 2000
      };
      
      // Add JSON mode if schema is provided
      if (request.schema) {
        body.response_format = { type: 'json_object' };
        
        // Add schema instruction to system message
        const schemaInstruction = 'Respond with valid JSON that matches the expected schema.';
        if (request.messages[0]?.role === 'system') {
          request.messages[0].content += '\n\n' + schemaInstruction;
        } else {
          request.messages.unshift({
            role: 'system',
            content: schemaInstruction
          });
        }
      }
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeout ?? 30000)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new AIError(
          `OpenAI API error: ${response.status} ${response.statusText}`,
          this.provider,
          errorData.error?.code || 'HTTP_ERROR',
          errorData
        );
      }
      
      const data = await response.json();
      
      const choice = data.choices?.[0];
      if (!choice) {
        throw new AIError(
          'No response choice returned from OpenAI',
          this.provider,
          'NO_CHOICE'
        );
      }
      
      return {
        content: choice.message.content,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        } : undefined,
        model: data.model,
        provider: this.provider
      };
      
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }
      
      throw new AIError(
        error instanceof Error ? error.message : 'Unknown OpenAI error',
        this.provider,
        'REQUEST_ERROR',
        error
      );
    }
  }
}