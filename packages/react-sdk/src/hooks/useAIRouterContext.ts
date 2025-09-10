import { createContext, useContext } from 'react';
import { AIRouterContextValue } from '../types/ai';

export const AIRouterContext = createContext<AIRouterContextValue | null>(null);

export function useAIRouterContext(): AIRouterContextValue {
  const context = useContext(AIRouterContext);
  
  if (!context) {
    throw new Error(
      'useAIRouterContext must be used within an AIRouterProvider. ' +
      'Make sure to wrap your component with <AIRouterProvider>.'
    );
  }
  
  return context;
}

/**
 * Hook to check if AI Router context is available
 */
export function useAIRouterAvailable(): boolean {
  const context = useContext(AIRouterContext);
  return context !== null;
}