// Main exports
export * from './types/ai';
export * from './schemas/poll';

// Providers
export { BaseAIProvider } from './providers/BaseAIProvider';
export { OpenAIProvider } from './providers/OpenAIProvider';
export { WebLLMProvider, getAvailableWebLLMModels, isWebLLMSupported, getRecommendedWebLLMModel } from './providers/WebLLMProvider';

// Router
export { AIRouter } from './router/AIRouter';

// React components and hooks
export { AIRouterProvider, withAIRouter, useAIRouterConfig } from './components/AIRouterProvider';
export { useAIRouter, useAIRouterBatch, useAIRouterStream } from './hooks/useAIRouter';
export { useAIRouterContext, useAIRouterAvailable } from './hooks/useAIRouterContext';

// Routes
export * from './routes/pollRoutes';

// Configuration
export * from './config/index';

// Utilities
export { JSONValidator, validateJSON, safeParseJSON } from './utils/jsonValidator';

// Re-export zod for schema validation
export { z } from 'zod';