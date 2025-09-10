import { z } from 'zod';
import { 
  AIProvider, 
  AIProviderConfig, 
  AIRequest, 
  AIResponse, 
  AIError, 
  AIValidationError,
  AIRoute
} from '../types/ai';

export abstract class BaseAIProvider {
  protected config: AIProviderConfig;
  
  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  abstract get provider(): AIProvider;
  
  abstract isAvailable(): Promise<boolean>;
  
  protected abstract _makeRequest(request: AIRequest): Promise<AIResponse>;
  
  /**
   * Execute a request with validation and error handling
   */
  async execute<TInput, TOutput>(
    route: AIRoute<TInput, TOutput>,
    input: TInput
  ): Promise<TOutput> {
    try {
      // Validate input
      const validatedInput = route.inputSchema.parse(input);
      
      // Build prompt from route and input
      const prompt = this.buildPrompt(route, validatedInput);
      
      // Create AI request
      const request: AIRequest = {
        messages: [
          ...(route.systemPrompt ? [{ role: 'system' as const, content: route.systemPrompt }] : []),
          { role: 'user' as const, content: prompt }
        ],
        schema: route.outputSchema,
        temperature: route.temperature ?? this.config.temperature,
        maxTokens: route.maxTokens ?? this.config.maxTokens
      };
      
      // Execute request
      const response = await this._makeRequest(request);
      
      // Parse and validate output
      const parsedOutput = this.parseAndValidateOutput(response, route.outputSchema);
      
      return parsedOutput;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AIValidationError(
          `Validation failed for route ${route.path}`,
          this.provider,
          error
        );
      }
      
      if (error instanceof AIError) {
        throw error;
      }
      
      throw new AIError(
        error instanceof Error ? error.message : 'Unknown AI provider error',
        this.provider,
        'UNKNOWN_ERROR',
        error
      );
    }
  }
  
  /**
   * Build prompt from route definition and input
   */
  protected buildPrompt<TInput>(route: AIRoute<TInput>, input: TInput): string {
    let prompt = `Route: ${route.path}\nDescription: ${route.description}\n\n`;
    
    // Add input data
    prompt += `Input:\n${JSON.stringify(input, null, 2)}\n\n`;
    
    // Add examples if available
    if (route.examples && route.examples.length > 0) {
      prompt += 'Examples:\n';
      route.examples.forEach((example, index) => {
        prompt += `Example ${index + 1}:\n`;
        prompt += `Input: ${JSON.stringify(example.input, null, 2)}\n`;
        prompt += `Output: ${JSON.stringify(example.output, null, 2)}\n`;
        if (example.description) {
          prompt += `Description: ${example.description}\n`;
        }
        prompt += '\n';
      });
    }
    
    // Add schema instructions
    prompt += 'Please respond with valid JSON that matches the expected output schema.\n';
    prompt += 'Ensure your response is properly formatted and contains all required fields.\n';
    
    return prompt;
  }
  
  /**
   * Parse and validate AI response output
   */
  protected parseAndValidateOutput<TOutput>(
    response: AIResponse,
    schema: z.ZodSchema<TOutput>
  ): TOutput {
    try {
      // Try to parse JSON from response
      let jsonContent: any;
      
      // Clean up response content - remove markdown code blocks if present
      let content = response.content.trim();
      if (content.startsWith('```json')) {
        content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (content.startsWith('```')) {
        content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      try {
        jsonContent = JSON.parse(content);
      } catch (parseError) {
        // Try to extract JSON from response using regex
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonContent = JSON.parse(jsonMatch[0]);
        } else {
          throw new AIError(
            'Failed to parse JSON from AI response',
            response.provider,
            'JSON_PARSE_ERROR',
            { content, parseError }
          );
        }
      }
      
      // Validate against schema
      const validated = schema.parse(jsonContent);
      return validated;
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AIValidationError(
          'AI response does not match expected schema',
          response.provider,
          error
        );
      }
      throw error;
    }
  }
  
  /**
   * Update provider configuration
   */
  updateConfig(newConfig: Partial<AIProviderConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
  
  /**
   * Test provider connectivity
   */
  async test(): Promise<boolean> {
    try {
      const testRequest: AIRequest = {
        messages: [{ role: 'user', content: 'Hello, respond with "OK"' }],
        maxTokens: 10,
        temperature: 0
      };
      
      const response = await this._makeRequest(testRequest);
      return response.content.toLowerCase().includes('ok');
    } catch {
      return false;
    }
  }
}