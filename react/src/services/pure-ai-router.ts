/**
 * Pure AI Router for React - Direct AI-based oracle selection without complex logic
 * Uses GPT-4o-mini and o3-mini for pure AI determination
 */

import axios from 'axios';

export interface OracleRoutingRequest {
  question: string;
  categoryHint?: string;
  maxCostUsd?: number;
  maxLatencyMs?: number;
  requiredChains?: string[];
  preferredProviders?: string[];
}

export interface PureAIResponse {
  can_resolve: boolean;
  selected_oracle: string;
  reasoning: string;
  confidence_score: number;
  data_type: string;
  required_feeds: string[];
  estimated_cost_usd: number;
  estimated_latency_ms: number;
  oracle_config: Record<string, any>;
}

export interface OracleRoutingResponse {
  canResolve: boolean;
  selectedOracle: string | null;
  reasoning: string;
  confidenceScore: number;
  oracleConfig: Record<string, any>;
  alternatives: string[] | null;
  dataType: string | null;
  requiredFeeds: string[];
  estimatedCostUsd: number | null;
  estimatedLatencyMs: number | null;
  resolutionMethod: string;
  updateFrequency: string | null;
}

export class PureAIRouter {
  private apiKey: string;
  private baseUrl: string = 'https://openrouter.ai/api/v1';
  private model: string = 'openai/gpt-4o-mini';
  private backupModel: string = 'openai/o3-mini';

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    if (model) this.model = model;
  }

  async routeQuestion(request: OracleRoutingRequest): Promise<OracleRoutingResponse> {
    try {
      // Use primary model (GPT-4o-mini)
      let response = await this.getAIRoutingDecision(request, this.model);
      if (response) {
        return response;
      }

      // Fallback to o3-mini if primary fails
      console.log('Primary model failed, trying o3-mini');
      response = await this.getAIRoutingDecision(request, this.backupModel);
      if (response) {
        return response;
      }

      // Final fallback
      return {
        canResolve: false,
        reasoning: 'AI routing services unavailable',
        confidenceScore: 0.0,
        selectedOracle: null,
        oracleConfig: {},
        alternatives: null,
        dataType: null,
        requiredFeeds: [],
        estimatedCostUsd: null,
        estimatedLatencyMs: null,
        resolutionMethod: 'unavailable',
        updateFrequency: null
      };
    } catch (error) {
      console.error('Pure AI routing failed:', error);
      return {
        canResolve: false,
        reasoning: `AI routing error: ${error}`,
        confidenceScore: 0.0,
        selectedOracle: null,
        oracleConfig: {},
        alternatives: null,
        dataType: null,
        requiredFeeds: [],
        estimatedCostUsd: null,
        estimatedLatencyMs: null,
        resolutionMethod: 'error',
        updateFrequency: null
      };
    }
  }

  private async getAIRoutingDecision(
    request: OracleRoutingRequest, 
    model: string
  ): Promise<OracleRoutingResponse | null> {
    const prompt = this.buildPureAIPrompt(request);

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model,
          messages: [
            {
              role: 'system',
              content: this.getPureAISystemPrompt()
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1, // Low temperature for consistent decisions
          max_tokens: 1000,
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 45000
        }
      );

      if (response.status === 200) {
        const aiContent = response.data.choices[0].message.content;
        const aiData: PureAIResponse = JSON.parse(aiContent);
        return this.convertAIResponseToOracleResponse(aiData);
      } else {
        console.error(`AI API error: ${response.status}`);
        return null;
      }
    } catch (error) {
      console.error(`AI request failed with ${model}:`, error);
      return null;
    }
  }

  private getPureAISystemPrompt(): string {
    return `You are an expert oracle routing AI for React applications. Your job is to analyze prediction market questions and select the optimal oracle provider.

Available Oracle Providers:
- CHAINLINK: Most reliable, price feeds, sports data via TheRundown, weather via AccuWeather, 99% uptime, $0.50 cost, 500ms latency
- PYTH: Real-time crypto/stock prices, sub-second updates, $0.10 cost, 100ms latency, best for price feeds
- UMA: Optimistic oracle with human verification, perfect for elections/complex events, $100 cost (includes bond), 2 hour latency
- BAND: Cross-chain data, custom API requests, flexible, $0.30 cost, 1000ms latency
- API3: First-party oracles, weather (NOAA), NFT floors, signed data, $0.25 cost, 800ms latency

Make your decision based on:
1. Question type and requirements
2. Data source reliability needs  
3. Resolution timeline requirements
4. Cost vs accuracy tradeoffs
5. Verification mechanisms needed
6. React app performance considerations

Always respond with valid JSON matching the exact schema provided.`;
  }

  private buildPureAIPrompt(request: OracleRoutingRequest): string {
    const constraints: string[] = [];
    
    if (request.maxCostUsd) {
      constraints.push(`Maximum cost: $${request.maxCostUsd}`);
    }
    if (request.maxLatencyMs) {
      constraints.push(`Maximum latency: ${request.maxLatencyMs}ms`);
    }
    if (request.requiredChains) {
      constraints.push(`Required chains: ${request.requiredChains.join(', ')}`);
    }
    if (request.preferredProviders) {
      constraints.push(`Preferred providers: ${request.preferredProviders.join(', ')}`);
    }

    const constraintsText = constraints.length > 0 
      ? constraints.map(c => `- ${c}`).join('\n')
      : '- No specific constraints';

    return `
Analyze this prediction market question for a React application and select the optimal oracle:

QUESTION: "${request.question}"

CONSTRAINTS:
${constraintsText}

CATEGORY HINT: ${request.categoryHint || 'None provided'}

REACT CONTEXT: This is for a React application requiring real-time updates and good UX performance.

Analyze the question and respond with JSON in this EXACT format:
{
    "can_resolve": true/false,
    "selected_oracle": "CHAINLINK|PYTH|UMA|BAND|API3",
    "reasoning": "Clear explanation of why this oracle was selected for React app",
    "confidence_score": 0.0-1.0,
    "data_type": "PRICE|SPORTS|WEATHER|ELECTION|ECONOMIC|CUSTOM|EVENTS|NFT|STOCKS|FOREX|COMMODITIES|RANDOM",
    "required_feeds": ["list", "of", "data", "feeds"],
    "estimated_cost_usd": 0.0,
    "estimated_latency_ms": 0,
    "oracle_config": {
        "provider": "oracle_name",
        "react_optimizations": "any_react_specific_config",
        "polling_interval": 30000,
        "cache_duration": 60000
    }
}

Focus on:
1. What type of prediction is this?
2. What data sources are needed?
3. How quickly does it need to resolve?
4. What level of verification is required?
5. Which oracle provides best React integration?
6. Performance impact on React app?

Make your best judgment based on the question content and oracle capabilities for React applications.
`;
  }

  private convertAIResponseToOracleResponse(aiData: PureAIResponse): OracleRoutingResponse {
    try {
      return {
        canResolve: aiData.can_resolve,
        selectedOracle: aiData.selected_oracle || null,
        reasoning: aiData.reasoning || 'AI decision',
        confidenceScore: aiData.confidence_score || 0.0,
        oracleConfig: aiData.oracle_config || {},
        alternatives: null, // Pure AI mode doesn't provide alternatives
        dataType: aiData.data_type || null,
        requiredFeeds: aiData.required_feeds || [],
        estimatedCostUsd: aiData.estimated_cost_usd || 0.0,
        estimatedLatencyMs: aiData.estimated_latency_ms || 0,
        resolutionMethod: 'ai_determined',
        updateFrequency: null // AI will determine this implicitly
      };
    } catch (error) {
      console.error('Failed to convert AI response:', error);
      return {
        canResolve: false,
        reasoning: `AI response parsing error: ${error}`,
        confidenceScore: 0.0,
        selectedOracle: null,
        oracleConfig: {},
        alternatives: null,
        dataType: null,
        requiredFeeds: [],
        estimatedCostUsd: null,
        estimatedLatencyMs: null,
        resolutionMethod: 'error',
        updateFrequency: null
      };
    }
  }
}

export class PureAgentRouter {
  private apiKey: string;
  private pureAIRouter: PureAIRouter;

  // Specialized agent prompts for React applications
  private agentPrompts: Record<string, string> = {
    crypto_agent: `You are a crypto prediction market specialist for React applications. 
      Focus on cryptocurrency price movements, DeFi protocols, and blockchain events.
      Prefer Pyth for real-time crypto prices with WebSocket updates for React.
      Consider React Query caching and state management for crypto data.`,
      
    sports_agent: `You are a sports betting specialist for React applications.
      Focus on game outcomes, player performance, and tournament results.
      Prefer Chainlink for official sports data via TheRundown partnership.
      Optimize for real-time score updates and live betting UX in React.`,
      
    politics_agent: `You are a political prediction market specialist for React applications.
      Focus on elections, policy decisions, and governmental actions.
      Prefer UMA for human-verified election results and complex political events.
      Consider polling intervals and result verification delays for React UX.`,
      
    economics_agent: `You are an economic prediction market specialist for React applications.
      Focus on Fed decisions, economic indicators, and market movements.
      Use UMA for Fed decisions, Chainlink for automated economic data.
      Optimize for scheduled data releases and React state updates.`,
      
    events_agent: `You are a general events prediction specialist for React applications.
      Focus on corporate announcements, product launches, and custom events.
      Use UMA for complex verification, Band for custom data needs.
      Consider event scheduling and notification systems for React apps.`
  };

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.pureAIRouter = new PureAIRouter(apiKey);
  }

  async routeWithSpecializedAgent(request: OracleRoutingRequest): Promise<OracleRoutingResponse> {
    // First, determine which agent to use
    const agentType = this.selectAgent(request.question);
    
    // Use the specialized agent
    return this.routeWithAgent(request, agentType);
  }

  private selectAgent(question: string): string {
    const questionLower = question.toLowerCase();
    
    // Simple keyword-based agent selection optimized for React apps
    if (questionLower.match(/btc|eth|crypto|bitcoin|ethereum|defi|token|coin/)) {
      return 'crypto_agent';
    } else if (questionLower.match(/game|win|sport|nfl|nba|championship|team|player/)) {
      return 'sports_agent';
    } else if (questionLower.match(/election|vote|president|congress|senate|poll/)) {
      return 'politics_agent';
    } else if (questionLower.match(/fed|interest rate|inflation|gdp|unemployment|economy/)) {
      return 'economics_agent';
    } else {
      return 'events_agent';
    }
  }

  private async routeWithAgent(
    request: OracleRoutingRequest, 
    agentType: string
  ): Promise<OracleRoutingResponse> {
    // Create a specialized router for this agent
    const specializedRouter = new PureAIRouter(this.apiKey);
    
    // Override the system prompt with agent specialization
    const agentPrompt = this.agentPrompts[agentType] || this.agentPrompts['events_agent'];
    const originalPrompt = specializedRouter['getPureAISystemPrompt']();
    const specializedPrompt = `${originalPrompt}

AGENT SPECIALIZATION FOR REACT:
${agentPrompt}

Apply your specialized knowledge to make the best oracle selection for this question type in a React application context.
Consider React-specific factors like:
- Component re-render optimization
- Real-time data streaming
- State management integration
- User experience during data loading
- Error boundaries and fallbacks`;
    
    // Monkey patch the method temporarily
    const originalMethod = specializedRouter['getPureAISystemPrompt'];
    specializedRouter['getPureAISystemPrompt'] = () => specializedPrompt;
    
    try {
      const result = await specializedRouter.routeQuestion(request);
      // Add agent info to reasoning
      if (result.reasoning) {
        result.reasoning = `[${agentType.toUpperCase()}] ${result.reasoning}`;
      }
      return result;
    } finally {
      // Restore original method
      specializedRouter['getPureAISystemPrompt'] = originalMethod;
    }
  }
}