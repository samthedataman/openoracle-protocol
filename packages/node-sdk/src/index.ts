/**
 * OpenOracle SDK - Intelligent Oracle Routing for Prediction Markets
 * 
 * A comprehensive Node.js SDK for building prediction markets with intelligent
 * oracle selection and data verification.
 * 
 * Key Components:
 * - OracleRouter: Intelligent routing to optimal oracle providers
 * - TwitterParser: Social media integration and analysis
 * - ReActAgent: AI-driven decision making with explainable reasoning
 * - MultiOracleAggregator: Consensus mechanisms across oracle networks
 * - SchemaValidator: Type-safe data validation
 * 
 * @example
 * ```typescript
 * import { OracleRouter, TwitterParser, OracleConfig } from 'openoracle-sdk'
 * 
 * // Initialize the router with API keys
 * const config = OracleConfig.fromEnv()
 * const router = new OracleRouter(config)
 * 
 * // Route a question to the best oracle
 * const response = await router.routeQuestion(
 *   "Will BTC exceed $100k by end of 2024?"
 * )
 * console.log(`Selected: ${response.oracleProvider}`)
 * console.log(`Confidence: ${response.confidence}`)
 * 
 * // Parse Twitter content for prediction markets
 * const twitter = new TwitterParser(config)
 * const prediction = await twitter.createPredictionFromTweet(tweetData)
 * ```
 */

export const VERSION = '0.1.0'
export const AUTHOR = 'OpenOracle Team'
export const LICENSE = 'MIT'
export const DESCRIPTION = 'Intelligent Oracle Routing for Prediction Markets'

// Core classes - main public API
export { OracleRouter } from './core/router'
export { OracleConfig, getConfig, setConfig } from './core/config'
export { OracleClient } from './core/client'

// Exceptions
export * from './core/exceptions'

// API clients
export { OracleAPI } from './api/oracle-api'
export { TwitterAPI } from './api/twitter-api'
export { PollAPI } from './api/poll-api'

// Schema validation and models
export * from './schemas/oracle-schemas'

// Oracle providers
export { BaseOracleProvider } from './providers/base'
export { ChainlinkProvider } from './providers/chainlink'
export { PythProvider } from './providers/pyth'
export { UMAProvider } from './providers/uma'
export { BandProvider } from './providers/band'
export { API3Provider } from './providers/api3'

// Enums and constants
export * from './types/enums'

// Utilities
export { getLogger, OracleLogger, createTimer, logPerformance } from './utils/logger'
export * from './utils/async-helpers'

// AI services
export { AIRoutingService } from './ai-oracle-routing-service'

// LLM Providers
export {
  LLMProvider,
  LLMRouter,
  BaseLLMProvider,
  OpenAIProvider,
  OpenRouterProvider,
  WebLLMProvider,
  ChatMessage,
  MessageRole,
  LLMRequest,
  LLMResponse,
  TokenUsage,
  ProviderConfig,
  createOpenAIProvider,
  createOpenRouterProvider,
  createWebLLMProvider,
  createLLMRouter,
  generateResponse,
  generateJsonResponse
} from './ai/llm-providers'

// Package metadata
export const META = {
  name: 'openoracle-sdk',
  version: VERSION,
  description: DESCRIPTION,
  author: AUTHOR,
  license: LICENSE,
  nodeRequires: '>=16.0.0',
  homepage: 'https://github.com/openoracle/node-sdk',
  documentation: 'https://docs.openoracle.ai',
  repository: 'https://github.com/openoracle/node-sdk.git',
}

/**
 * Get the current version of the OpenOracle SDK.
 */
export function getVersion(): string {
  return VERSION
}

/**
 * Get package information as an object.
 */
export function getInfo(): typeof META {
  return { ...META }
}

// Default export for convenience
export default {
  // Core
  OracleRouter,
  OracleConfig,
  OracleClient,
  getConfig,
  setConfig,
  
  // APIs
  OracleAPI,
  TwitterAPI,
  PollAPI,
  
  // Providers
  BaseOracleProvider,
  ChainlinkProvider,
  PythProvider,
  UMAProvider,
  BandProvider,
  API3Provider,
  
  // AI Services
  AIRoutingService,
  
  // Utils  
  getVersion,
  getInfo,
  
  // Metadata
  VERSION,
  META
}