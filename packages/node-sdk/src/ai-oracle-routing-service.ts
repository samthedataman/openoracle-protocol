/**
 * AI-powered Oracle Routing Service
 */

import { OracleConfig } from './core/config'
import { OracleClient } from './core/client'
import { 
  OracleProvider, 
  DataCategory, 
  RoutingStrategy,
  ConfidenceLevel 
} from './types/enums'
import {
  OracleRoutingRequest,
  OracleRoutingResponse,
  ProviderCapabilities
} from './schemas/oracle-schemas'
import { ValidationError, ProviderError } from './core/exceptions'

export interface AIRoutingContext {
  userHistory?: Array<{
    query: string
    selectedProvider: OracleProvider
    success: boolean
    confidence: ConfidenceLevel
    timestamp: Date
  }>
  marketConditions?: {
    volatility: number
    liquidity: number
    timeOfDay: number
    marketOpen: boolean
  }
  providerMetrics?: Map<OracleProvider, {
    uptime: number
    responseTime: number
    accuracy: number
    cost: number
  }>
}

export interface AIRoutingDecision {
  recommendedProvider: OracleProvider
  confidence: ConfidenceLevel
  reasoning: string
  alternativeProviders: OracleProvider[]
  riskAssessment: {
    dataQuality: number
    providerReliability: number
    costEfficiency: number
    overallRisk: number
  }
  estimatedOutcome: {
    successProbability: number
    expectedResponseTime: number
    expectedCost: number
  }
}

export class AIRoutingService {
  private readonly config: OracleConfig
  private readonly client: OracleClient
  private readonly modelEndpoint: string
  private readonly routingHistory: Map<string, AIRoutingDecision[]> = new Map()

  constructor(config: OracleConfig, client: OracleClient) {
    this.config = config
    this.client = client
    this.modelEndpoint = this.getAIModelEndpoint()
  }

  private getAIModelEndpoint(): string {
    if (this.config.apiKeys.openai) {
      return 'https://api.openai.com/v1/chat/completions'
    }
    return '/api/ai/routing' // Fallback to local API
  }

  /**
   * Use AI to determine the optimal oracle provider for a query
   */
  async routeQuery(
    request: OracleRoutingRequest,
    context?: AIRoutingContext
  ): Promise<AIRoutingDecision> {
    try {
      // Analyze the query using AI
      const queryAnalysis = await this.analyzeQuery(request.query, request.category)
      
      // Get provider capabilities
      const availableProviders = await this.getAvailableProviders(request)
      
      // Create AI prompt for routing decision
      const aiPrompt = this.buildRoutingPrompt(request, queryAnalysis, availableProviders, context)
      
      // Get AI recommendation
      const aiResponse = await this.callAIModel(aiPrompt)
      
      // Parse and validate AI response
      const decision = this.parseAIResponse(aiResponse, availableProviders)
      
      // Store decision in history for learning
      this.storeRoutingDecision(request.query, decision)
      
      return decision

    } catch (error) {
      throw new ProviderError(
        `AI routing failed: ${error instanceof Error ? error.message : String(error)}`,
        'ai_routing_service'
      )
    }
  }

  /**
   * Analyze query to extract key information
   */
  private async analyzeQuery(query: string, category: DataCategory): Promise<{
    intent: string
    complexity: 'low' | 'medium' | 'high'
    urgency: 'low' | 'medium' | 'high'
    dataRequirements: {
      realTime: boolean
      historical: boolean
      accuracy: 'low' | 'medium' | 'high'
      consensus: boolean
    }
    extractedEntities: Array<{
      type: string
      value: string
      confidence: number
    }>
  }> {
    const analysisPrompt = `
      Analyze this oracle query and extract key information:
      
      Query: "${query}"
      Category: ${category}
      
      Please provide:
      1. Intent (what the user is trying to achieve)
      2. Complexity level (low/medium/high)
      3. Urgency level (low/medium/high)
      4. Data requirements:
         - Real-time data needed?
         - Historical data needed?
         - Required accuracy level?
         - Consensus from multiple sources needed?
      5. Extracted entities (symbols, dates, numbers, etc.)
      
      Respond in JSON format.
    `

    try {
      const response = await this.callAIModel(analysisPrompt)
      return JSON.parse(response)
    } catch (error) {
      // Fallback to simple analysis
      return {
        intent: 'data_query',
        complexity: 'medium',
        urgency: 'medium',
        dataRequirements: {
          realTime: true,
          historical: false,
          accuracy: 'high',
          consensus: false
        },
        extractedEntities: []
      }
    }
  }

  /**
   * Build AI prompt for routing decision
   */
  private buildRoutingPrompt(
    request: OracleRoutingRequest,
    analysis: any,
    providers: ProviderCapabilities[],
    context?: AIRoutingContext
  ): string {
    return `
You are an expert oracle routing AI. Your task is to select the best oracle provider for a data query.

QUERY DETAILS:
- Query: "${request.query}"
- Category: ${request.category}
- Intent: ${analysis.intent}
- Complexity: ${analysis.complexity}
- Urgency: ${analysis.urgency}

DATA REQUIREMENTS:
- Real-time: ${analysis.dataRequirements.realTime}
- Historical: ${analysis.dataRequirements.historical}
- Accuracy: ${analysis.dataRequirements.accuracy}
- Consensus: ${analysis.dataRequirements.consensus}

AVAILABLE PROVIDERS:
${providers.map(p => `
- ${p.provider}:
  * Capabilities: ${p.capabilities.join(', ')}
  * Supported categories: ${p.supportedCategories.join(', ')}
  * Cost per query: $${p.costPerQuery}
  * Avg response time: ${p.averageResponseTimeMs}ms
  * Reliability: ${(p.reliability * 100).toFixed(1)}%
  * Accuracy: ${(p.accuracy * 100).toFixed(1)}%
`).join('')}

CONTEXT:
${context?.marketConditions ? `
Market Conditions:
- Volatility: ${context.marketConditions.volatility}
- Liquidity: ${context.marketConditions.liquidity}
- Market Open: ${context.marketConditions.marketOpen}
` : ''}

${context?.userHistory ? `
Recent User History:
${context.userHistory.slice(-3).map(h => 
  `- Query: "${h.query}" → ${h.selectedProvider} (${h.success ? 'Success' : 'Failed'})`
).join('\n')}
` : ''}

Please select the best provider and respond in this JSON format:
{
  "recommendedProvider": "provider_name",
  "confidence": "very_high|high|medium|low|very_low",
  "reasoning": "detailed explanation of why this provider was chosen",
  "alternativeProviders": ["provider1", "provider2"],
  "riskAssessment": {
    "dataQuality": 0.8,
    "providerReliability": 0.9,
    "costEfficiency": 0.7,
    "overallRisk": 0.2
  },
  "estimatedOutcome": {
    "successProbability": 0.92,
    "expectedResponseTime": 1500,
    "expectedCost": 0.01
  }
}

Consider:
1. Provider capabilities vs query requirements
2. Historical performance and reliability
3. Cost effectiveness
4. Response time requirements
5. Risk tolerance
6. Market conditions
    `
  }

  /**
   * Call AI model for routing decision
   */
  private async callAIModel(prompt: string): Promise<string> {
    if (this.config.apiKeys.openai) {
      return this.callOpenAI(prompt)
    } else {
      return this.callLocalAI(prompt)
    }
  }

  private async callOpenAI(prompt: string): Promise<string> {
    const response = await this.client.post('', {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert oracle routing AI assistant. Always respond with valid JSON when requested.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 1000
    }, {
      baseURL: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${this.config.apiKeys.openai}`,
        'Content-Type': 'application/json'
      }
    })

    return response.choices[0]?.message?.content || ''
  }

  private async callLocalAI(prompt: string): Promise<string> {
    const response = await this.client.post('/api/ai/routing', {
      prompt,
      model: 'routing-model-v1'
    })

    return response.response || ''
  }

  /**
   * Parse AI response into routing decision
   */
  private parseAIResponse(
    response: string,
    availableProviders: ProviderCapabilities[]
  ): AIRoutingDecision {
    try {
      const parsed = JSON.parse(response)
      
      // Validate provider exists
      const provider = parsed.recommendedProvider as OracleProvider
      if (!availableProviders.find(p => p.provider === provider)) {
        throw new Error(`Recommended provider ${provider} not available`)
      }

      // Map confidence level
      const confidenceMap: Record<string, ConfidenceLevel> = {
        'very_high': ConfidenceLevel.VERY_HIGH,
        'high': ConfidenceLevel.HIGH,
        'medium': ConfidenceLevel.MEDIUM,
        'low': ConfidenceLevel.LOW,
        'very_low': ConfidenceLevel.VERY_LOW
      }

      return {
        recommendedProvider: provider,
        confidence: confidenceMap[parsed.confidence] || ConfidenceLevel.MEDIUM,
        reasoning: parsed.reasoning || 'AI recommendation',
        alternativeProviders: parsed.alternativeProviders || [],
        riskAssessment: {
          dataQuality: parsed.riskAssessment?.dataQuality || 0.8,
          providerReliability: parsed.riskAssessment?.providerReliability || 0.8,
          costEfficiency: parsed.riskAssessment?.costEfficiency || 0.8,
          overallRisk: parsed.riskAssessment?.overallRisk || 0.2
        },
        estimatedOutcome: {
          successProbability: parsed.estimatedOutcome?.successProbability || 0.8,
          expectedResponseTime: parsed.estimatedOutcome?.expectedResponseTime || 2000,
          expectedCost: parsed.estimatedOutcome?.expectedCost || 0.01
        }
      }

    } catch (error) {
      // Fallback to simple heuristic-based routing
      return this.fallbackRouting(availableProviders)
    }
  }

  /**
   * Fallback routing when AI fails
   */
  private fallbackRouting(providers: ProviderCapabilities[]): AIRoutingDecision {
    // Simple heuristic: choose provider with best reliability * accuracy / cost ratio
    const scored = providers.map(p => ({
      provider: p.provider,
      score: (p.reliability * p.accuracy) / (p.costPerQuery * p.averageResponseTimeMs)
    }))

    scored.sort((a, b) => b.score - a.score)
    const best = scored[0]

    return {
      recommendedProvider: best.provider,
      confidence: ConfidenceLevel.MEDIUM,
      reasoning: 'Fallback heuristic-based selection due to AI unavailability',
      alternativeProviders: scored.slice(1, 3).map(s => s.provider),
      riskAssessment: {
        dataQuality: 0.7,
        providerReliability: 0.7,
        costEfficiency: 0.7,
        overallRisk: 0.3
      },
      estimatedOutcome: {
        successProbability: 0.75,
        expectedResponseTime: 2000,
        expectedCost: 0.01
      }
    }
  }

  /**
   * Get available providers with their capabilities
   */
  private async getAvailableProviders(
    request: OracleRoutingRequest
  ): Promise<ProviderCapabilities[]> {
    // This would typically call the provider management service
    // For now, return mock data based on configuration
    const providers = Object.values(OracleProvider)
    
    return providers
      .filter(provider => {
        if (request.requiredProviders?.length) {
          return request.requiredProviders.includes(provider)
        }
        if (request.excludedProviders?.length) {
          return !request.excludedProviders.includes(provider)
        }
        return true
      })
      .map(provider => ({
        provider,
        capabilities: this.getProviderCapabilities(provider),
        supportedCategories: this.getSupportedCategories(provider),
        updateFrequencies: [],
        costPerQuery: this.getProviderCost(provider),
        averageResponseTimeMs: this.getProviderResponseTime(provider),
        reliability: this.getProviderReliability(provider),
        accuracy: this.getProviderAccuracy(provider)
      }))
  }

  private getProviderCapabilities(provider: OracleProvider): any[] {
    // Mock implementation
    return []
  }

  private getSupportedCategories(provider: OracleProvider): DataCategory[] {
    // Mock implementation
    return [DataCategory.PRICE, DataCategory.CRYPTO]
  }

  private getProviderCost(provider: OracleProvider): number {
    const costs = {
      [OracleProvider.CHAINLINK]: 0.01,
      [OracleProvider.PYTH]: 0.005,
      [OracleProvider.UMA]: 0.02,
      [OracleProvider.BAND]: 0.015,
      [OracleProvider.API3]: 0.01
    } as Record<OracleProvider, number>
    
    return costs[provider] || 0.01
  }

  private getProviderResponseTime(provider: OracleProvider): number {
    const times = {
      [OracleProvider.CHAINLINK]: 1500,
      [OracleProvider.PYTH]: 800,
      [OracleProvider.UMA]: 3000,
      [OracleProvider.BAND]: 2000,
      [OracleProvider.API3]: 1200
    } as Record<OracleProvider, number>
    
    return times[provider] || 2000
  }

  private getProviderReliability(provider: OracleProvider): number {
    const reliability = {
      [OracleProvider.CHAINLINK]: 0.98,
      [OracleProvider.PYTH]: 0.95,
      [OracleProvider.UMA]: 0.85,
      [OracleProvider.BAND]: 0.90,
      [OracleProvider.API3]: 0.92
    } as Record<OracleProvider, number>
    
    return reliability[provider] || 0.9
  }

  private getProviderAccuracy(provider: OracleProvider): number {
    const accuracy = {
      [OracleProvider.CHAINLINK]: 0.95,
      [OracleProvider.PYTH]: 0.93,
      [OracleProvider.UMA]: 0.88,
      [OracleProvider.BAND]: 0.90,
      [OracleProvider.API3]: 0.89
    } as Record<OracleProvider, number>
    
    return accuracy[provider] || 0.9
  }

  /**
   * Store routing decision for learning
   */
  private storeRoutingDecision(query: string, decision: AIRoutingDecision): void {
    const key = this.hashQuery(query)
    
    if (!this.routingHistory.has(key)) {
      this.routingHistory.set(key, [])
    }
    
    const history = this.routingHistory.get(key)!
    history.push(decision)
    
    // Keep only last 10 decisions per query pattern
    if (history.length > 10) {
      history.shift()
    }
  }

  private hashQuery(query: string): string {
    // Simple hash for grouping similar queries
    return query
      .toLowerCase()
      .replace(/[0-9]/g, 'N')
      .replace(/\s+/g, '_')
      .substring(0, 50)
  }

  /**
   * Learn from routing outcomes
   */
  async updateFromOutcome(
    query: string,
    decision: AIRoutingDecision,
    outcome: {
      success: boolean
      actualResponseTime: number
      actualCost: number
      actualConfidence: ConfidenceLevel
    }
  ): Promise<void> {
    // Store outcome for future learning
    // In a real implementation, this would update the AI model
    console.log('Learning from outcome:', { query, decision, outcome })
  }

  /**
   * Get routing statistics
   */
  getStats(): {
    totalRoutingDecisions: number
    averageConfidence: number
    providerUsageDistribution: Record<OracleProvider, number>
    routingAccuracy: number
  } {
    const allDecisions = Array.from(this.routingHistory.values()).flat()
    
    const providerUsage: Record<string, number> = {}
    let totalConfidence = 0
    
    allDecisions.forEach(decision => {
      providerUsage[decision.recommendedProvider] = 
        (providerUsage[decision.recommendedProvider] || 0) + 1
      
      const confidenceValues = {
        [ConfidenceLevel.VERY_LOW]: 0.1,
        [ConfidenceLevel.LOW]: 0.3,
        [ConfidenceLevel.MEDIUM]: 0.5,
        [ConfidenceLevel.HIGH]: 0.7,
        [ConfidenceLevel.VERY_HIGH]: 0.9
      }
      
      totalConfidence += confidenceValues[decision.confidence]
    })
    
    return {
      totalRoutingDecisions: allDecisions.length,
      averageConfidence: allDecisions.length > 0 ? totalConfidence / allDecisions.length : 0,
      providerUsageDistribution: providerUsage as any,
      routingAccuracy: 0.85 // Would be calculated from actual outcomes
    }
  }
}