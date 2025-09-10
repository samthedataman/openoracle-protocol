import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AIRouterContext } from '../hooks/useAIRouterContext';
import { AIRouter } from '../router/AIRouter';
import { 
  AIRouterConfig, 
  AIRouterContextValue, 
  AIRoute, 
  AIProviderConfig,
  AIProvider
} from '../types/ai';

interface AIRouterProviderProps {
  config: AIRouterConfig;
  children: React.ReactNode;
}

export function AIRouterProvider({ config, children }: AIRouterProviderProps) {
  const [router, setRouter] = useState<AIRouter>(() => new AIRouter(config));
  const [currentConfig, setCurrentConfig] = useState<AIRouterConfig>(config);
  const [availableProviders, setAvailableProviders] = useState<AIProvider[]>([]);
  
  // Update router when config changes
  useEffect(() => {
    const newRouter = new AIRouter(config);
    setRouter(newRouter);
    setCurrentConfig(config);
    
    // Cleanup old router
    return () => {
      router.cleanup();
    };
  }, [config]);
  
  // Check provider availability on mount and periodically
  useEffect(() => {
    const checkProviders = async () => {
      try {
        const available = await router.getAvailableProviders();
        setAvailableProviders(available);
      } catch (error) {
        console.warn('Failed to check provider availability:', error);
      }
    };
    
    checkProviders();
    
    // Check every 30 seconds
    const interval = setInterval(checkProviders, 30000);
    
    return () => clearInterval(interval);
  }, [router]);
  
  const updateConfig = useCallback((newConfig: Partial<AIRouterConfig>) => {
    const updatedConfig = { ...currentConfig, ...newConfig };
    setCurrentConfig(updatedConfig);
    router.updateConfig(newConfig);
  }, [currentConfig, router]);
  
  const executeRoute = useCallback(async <TInput, TOutput>(
    route: AIRoute<TInput, TOutput>,
    input: TInput,
    provider?: AIProviderConfig
  ): Promise<TOutput> => {
    return await router.execute(route, input, provider);
  }, [router]);
  
  const isProviderAvailable = useCallback((provider: AIProvider): boolean => {
    return availableProviders.includes(provider);
  }, [availableProviders]);
  
  const contextValue: AIRouterContextValue = useMemo(() => ({
    config: currentConfig,
    updateConfig,
    executeRoute,
    isProviderAvailable
  }), [currentConfig, updateConfig, executeRoute, isProviderAvailable]);
  
  return (
    <AIRouterContext.Provider value={contextValue}>
      {children}
    </AIRouterContext.Provider>
  );
}

/**
 * Higher-order component to provide AI Router context
 */
export function withAIRouter<P extends object>(
  Component: React.ComponentType<P>,
  config: AIRouterConfig
) {
  return function WithAIRouterComponent(props: P) {
    return (
      <AIRouterProvider config={config}>
        <Component {...props} />
      </AIRouterProvider>
    );
  };
}

/**
 * Hook to dynamically update AI Router configuration
 */
export function useAIRouterConfig() {
  const [config, setConfig] = useState<Partial<AIRouterConfig>>({});
  
  const updateConfig = useCallback((newConfig: Partial<AIRouterConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);
  
  const resetConfig = useCallback(() => {
    setConfig({});
  }, []);
  
  return {
    config,
    updateConfig,
    resetConfig
  };
}