import { useState, useCallback, useRef } from 'react';
import { 
  AIRoute, 
  AIProviderConfig, 
  AIError, 
  AIResponse, 
  UseAIRouterOptions, 
  UseAIRouterResult 
} from '../types/ai';
import { useAIRouterContext } from './useAIRouterContext';

export function useAIRouter<TInput, TOutput>(
  route: AIRoute<TInput, TOutput>,
  options?: Omit<UseAIRouterOptions, 'route'>
): UseAIRouterResult<TOutput> {
  const context = useAIRouterContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AIError | null>(null);
  const [response, setResponse] = useState<AIResponse<TOutput> | null>(null);
  
  // Store the last successful input for retry
  const lastInputRef = useRef<TInput | null>(null);
  
  const execute = useCallback(async (input: TInput): Promise<TOutput> => {
    setIsLoading(true);
    setError(null);
    lastInputRef.current = input;
    
    try {
      const result = await context.executeRoute(
        route,
        input,
        options?.provider
      );
      
      // Create response object
      const aiResponse: AIResponse<TOutput> = {
        content: JSON.stringify(result),
        parsed: result,
        provider: options?.provider?.provider || context.config.defaultProvider.provider,
        model: options?.provider?.model || context.config.defaultProvider.model
      };
      
      setResponse(aiResponse);
      options?.onSuccess?.(aiResponse);
      
      return result;
    } catch (err) {
      const aiError = err instanceof AIError ? err : new AIError(
        err instanceof Error ? err.message : 'Unknown error',
        options?.provider?.provider || context.config.defaultProvider.provider,
        'HOOK_ERROR',
        err
      );
      
      setError(aiError);
      options?.onError?.(aiError);
      
      throw aiError;
    } finally {
      setIsLoading(false);
    }
  }, [route, options, context]);
  
  const retry = useCallback(async (): Promise<TOutput | null> => {
    if (lastInputRef.current === null) {
      return null;
    }
    
    try {
      return await execute(lastInputRef.current);
    } catch (error) {
      // Error already handled in execute
      return null;
    }
  }, [execute]);
  
  return {
    execute,
    isLoading,
    error,
    response,
    retry
  };
}

/**
 * Hook for executing multiple AI routes in parallel
 */
export function useAIRouterBatch() {
  const context = useAIRouterContext();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<(AIError | null)[]>([]);
  const [responses, setResponses] = useState<(AIResponse | null)[]>([]);
  
  const executeBatch = useCallback(async <T>(
    requests: Array<{
      route: AIRoute<any, any>;
      input: any;
      provider?: AIProviderConfig;
    }>
  ): Promise<T[]> => {
    setIsLoading(true);
    setErrors(new Array(requests.length).fill(null));
    setResponses(new Array(requests.length).fill(null));
    
    try {
      const promises = requests.map(async (request, index) => {
        try {
          const result = await context.executeRoute(
            request.route,
            request.input,
            request.provider
          );
          
          const aiResponse: AIResponse = {
            content: JSON.stringify(result),
            parsed: result,
            provider: request.provider?.provider || context.config.defaultProvider.provider,
            model: request.provider?.model || context.config.defaultProvider.model
          };
          
          setResponses(prev => {
            const newResponses = [...prev];
            newResponses[index] = aiResponse;
            return newResponses;
          });
          
          return result;
        } catch (err) {
          const aiError = err instanceof AIError ? err : new AIError(
            err instanceof Error ? err.message : 'Unknown error',
            request.provider?.provider || context.config.defaultProvider.provider,
            'BATCH_ERROR',
            err
          );
          
          setErrors(prev => {
            const newErrors = [...prev];
            newErrors[index] = aiError;
            return newErrors;
          });
          
          throw aiError;
        }
      });
      
      return await Promise.all(promises);
    } finally {
      setIsLoading(false);
    }
  }, [context]);
  
  return {
    executeBatch,
    isLoading,
    errors,
    responses
  };
}

/**
 * Hook for streaming AI responses (for supported providers)
 */
export function useAIRouterStream<TInput, TOutput>(
  route: AIRoute<TInput, TOutput>,
  options?: Omit<UseAIRouterOptions, 'route'>
) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [error, setError] = useState<AIError | null>(null);
  const [finalResponse, setFinalResponse] = useState<AIResponse<TOutput> | null>(null);
  
  const executeStream = useCallback(async (input: TInput): Promise<void> => {
    setIsStreaming(true);
    setStreamContent('');
    setError(null);
    setFinalResponse(null);
    
    try {
      // Note: Streaming would need to be implemented in the provider
      // This is a placeholder for the streaming interface
      throw new Error('Streaming not yet implemented');
    } catch (err) {
      const aiError = err instanceof AIError ? err : new AIError(
        err instanceof Error ? err.message : 'Unknown streaming error',
        options?.provider?.provider || 'unknown' as any,
        'STREAM_ERROR',
        err
      );
      
      setError(aiError);
      options?.onError?.(aiError);
    } finally {
      setIsStreaming(false);
    }
  }, [route, options]);
  
  return {
    executeStream,
    isStreaming,
    streamContent,
    finalResponse,
    error
  };
}