/**
 * Poll API Client - Prediction market and polling functionality
 */

import { OracleClient } from '../core/client'
import { OracleConfig } from '../core/config'
import { DataCategory, ResolutionMethod, ConfidenceLevel } from '../types/enums'
import { OraclePollData, ValidationResult } from '../schemas/oracle-schemas'
import { ValidationError } from '../core/exceptions'

export interface CreatePollRequest {
  question: string
  description?: string
  category: DataCategory
  options: string[]
  endTime: Date
  resolutionMethod: ResolutionMethod
  minimumStake?: number
  maximumStake?: number
  creatorStake?: number
  tags?: string[]
  metadata?: Record<string, any>
}

export interface PollVote {
  pollId: string
  optionIndex: number
  stake: number
  confidence: ConfidenceLevel
  reasoning?: string
  timestamp: Date
  voterAddress: string
}

export interface PollResolution {
  pollId: string
  winningOption: number
  resolutionData: any
  resolutionSource: string
  confidence: ConfidenceLevel
  timestamp: Date
  totalPayout: number
  resolverAddress: string
}

export interface PollStatistics {
  pollId: string
  totalVotes: number
  totalStake: number
  uniqueVoters: number
  averageStake: number
  confidenceDistribution: Record<ConfidenceLevel, number>
  optionStatistics: Array<{
    option: string
    votes: number
    stake: number
    percentage: number
    averageConfidence: number
  }>
  timeSeriesData: Array<{
    timestamp: Date
    cumulativeVotes: number
    cumulativeStake: number
    optionPercentages: number[]
  }>
}

export interface UserPollActivity {
  userId: string
  totalPolls: number
  totalVotes: number
  totalStake: number
  successRate: number
  averageConfidence: number
  expertiseAreas: DataCategory[]
  recentPolls: OraclePollData[]
  recentVotes: PollVote[]
  earnings: {
    total: number
    thisMonth: number
    lastMonth: number
    averageReturn: number
  }
}

export class PollAPI {
  private readonly client: OracleClient
  private readonly config: OracleConfig

  constructor(client: OracleClient, config: OracleConfig) {
    this.client = client
    this.config = config
  }

  /**
   * Create a new prediction poll
   */
  async createPoll(request: CreatePollRequest): Promise<{ pollId: string }> {
    const validation = this.validatePollRequest(request)
    if (!validation.isValid) {
      throw new ValidationError(`Invalid poll request: ${validation.errors.join(', ')}`)
    }

    const response = await this.client.post('/api/polls', {
      question: request.question,
      description: request.description,
      category: request.category,
      options: request.options,
      end_time: request.endTime.toISOString(),
      resolution_method: request.resolutionMethod,
      minimum_stake: request.minimumStake,
      maximum_stake: request.maximumStake,
      creator_stake: request.creatorStake,
      tags: request.tags,
      metadata: request.metadata
    })

    return response.data
  }

  /**
   * Get poll details
   */
  async getPoll(pollId: string): Promise<OraclePollData> {
    const response = await this.client.get(`/api/polls/${pollId}`)
    return response.data
  }

  /**
   * List polls with filtering options
   */
  async listPolls(options?: {
    category?: DataCategory
    status?: 'active' | 'closed' | 'resolved' | 'cancelled'
    creator?: string
    tags?: string[]
    limit?: number
    offset?: number
    sortBy?: 'created_time' | 'end_time' | 'total_stake' | 'total_votes'
    sortOrder?: 'asc' | 'desc'
  }): Promise<{
    polls: OraclePollData[]
    total: number
    hasMore: boolean
  }> {
    const response = await this.client.get('/api/polls', {
      params: {
        category: options?.category,
        status: options?.status,
        creator: options?.creator,
        tags: options?.tags?.join(','),
        limit: options?.limit || 50,
        offset: options?.offset || 0,
        sort_by: options?.sortBy || 'created_time',
        sort_order: options?.sortOrder || 'desc'
      }
    })

    return response.data
  }

  /**
   * Vote on a poll
   */
  async vote(
    pollId: string,
    optionIndex: number,
    stake: number,
    confidence?: ConfidenceLevel,
    reasoning?: string
  ): Promise<{ success: boolean; voteId: string }> {
    if (stake <= 0) {
      throw new ValidationError('Stake must be positive')
    }

    if (optionIndex < 0) {
      throw new ValidationError('Option index must be non-negative')
    }

    const response = await this.client.post(`/api/polls/${pollId}/vote`, {
      option_index: optionIndex,
      stake,
      confidence: confidence || ConfidenceLevel.MEDIUM,
      reasoning
    })

    return response.data
  }

  /**
   * Get poll statistics
   */
  async getPollStatistics(pollId: string): Promise<PollStatistics> {
    const response = await this.client.get(`/api/polls/${pollId}/statistics`)
    return response.data
  }

  /**
   * Get user's voting history
   */
  async getUserActivity(userAddress: string): Promise<UserPollActivity> {
    const response = await this.client.get(`/api/polls/users/${userAddress}/activity`)
    return response.data
  }

  /**
   * Resolve a poll (for authorized resolvers)
   */
  async resolvePoll(
    pollId: string,
    winningOption: number,
    resolutionData: any,
    resolutionSource: string
  ): Promise<{ success: boolean; transactionHash?: string }> {
    const response = await this.client.post(`/api/polls/${pollId}/resolve`, {
      winning_option: winningOption,
      resolution_data: resolutionData,
      resolution_source: resolutionSource
    })

    return response.data
  }

  /**
   * Get poll resolution details
   */
  async getPollResolution(pollId: string): Promise<PollResolution> {
    const response = await this.client.get(`/api/polls/${pollId}/resolution`)
    return response.data
  }

  /**
   * Get trending polls
   */
  async getTrendingPolls(
    timeframe: '1h' | '6h' | '1d' | '1w' = '1d',
    category?: DataCategory
  ): Promise<Array<{
    poll: OraclePollData
    metrics: {
      voteVelocity: number
      stakeVelocity: number
      socialMentions: number
      trendingScore: number
    }
  }>> {
    const response = await this.client.get('/api/polls/trending', {
      params: {
        timeframe,
        category
      }
    })

    return response.data || []
  }

  /**
   * Search polls by keywords
   */
  async searchPolls(
    query: string,
    options?: {
      category?: DataCategory
      status?: 'active' | 'closed' | 'resolved'
      limit?: number
      includeContent?: boolean
    }
  ): Promise<OraclePollData[]> {
    const response = await this.client.get('/api/polls/search', {
      params: {
        q: query,
        category: options?.category,
        status: options?.status,
        limit: options?.limit || 50,
        include_content: options?.includeContent ?? true
      }
    })

    return response.data || []
  }

  /**
   * Get poll recommendations for user
   */
  async getRecommendations(
    userAddress: string,
    limit: number = 10
  ): Promise<Array<{
    poll: OraclePollData
    relevanceScore: number
    reason: string
  }>> {
    const response = await this.client.get(`/api/polls/users/${userAddress}/recommendations`, {
      params: { limit }
    })

    return response.data || []
  }

  /**
   * Subscribe to poll updates
   */
  subscribeToPollUpdates(
    pollId: string,
    callback: (update: {
      type: 'vote' | 'resolution' | 'status_change'
      data: any
      timestamp: Date
    }) => void
  ): EventSource {
    return this.client.createEventStream(`/api/polls/${pollId}/stream`, {
      onData: callback,
      onError: (error) => {
        console.error('Poll stream error:', error)
      }
    })
  }

  /**
   * Subscribe to new polls in category
   */
  subscribeToNewPolls(
    category: DataCategory,
    callback: (poll: OraclePollData) => void
  ): EventSource {
    return this.client.createEventStream(`/api/polls/stream/new?category=${category}`, {
      onData: callback,
      onError: (error) => {
        console.error('New polls stream error:', error)
      }
    })
  }

  /**
   * Get market maker opportunities
   */
  async getMarketMakerOpportunities(
    minLiquidity: number,
    maxRisk: number,
    categories?: DataCategory[]
  ): Promise<Array<{
    poll: OraclePollData
    opportunity: {
      expectedReturn: number
      riskScore: number
      liquidityNeeded: number
      timeToResolution: number
      confidenceGap: number
    }
  }>> {
    const response = await this.client.get('/api/polls/market-maker/opportunities', {
      params: {
        min_liquidity: minLiquidity,
        max_risk: maxRisk,
        categories: categories?.join(',')
      }
    })

    return response.data || []
  }

  /**
   * Create automated poll resolution
   */
  async createAutomatedResolution(
    pollId: string,
    resolutionConfig: {
      oracleProviders: string[]
      consensusThreshold: number
      dataSource: string
      resolutionLogic: string
      fallbackMethod?: ResolutionMethod
    }
  ): Promise<{ success: boolean; resolutionId: string }> {
    const response = await this.client.post(`/api/polls/${pollId}/automated-resolution`, resolutionConfig)
    return response.data
  }

  /**
   * Get poll analytics
   */
  async getPollAnalytics(
    pollId: string
  ): Promise<{
    demographics: {
      voterDistribution: Record<string, number>
      experienceDistribution: Record<string, number>
      geographicDistribution: Record<string, number>
    }
    predictions: {
      currentProbabilities: number[]
      probabilityHistory: Array<{
        timestamp: Date
        probabilities: number[]
      }>
      expertPredictions: Array<{
        expert: string
        prediction: number
        confidence: number
        track_record: number
      }>
    }
    market: {
      efficiency: number
      liquidity: number
      volatility: number
      arbitrageOpportunities: Array<{
        description: string
        profit: number
        risk: number
      }>
    }
  }> {
    const response = await this.client.get(`/api/polls/${pollId}/analytics`)
    return response.data
  }

  private validatePollRequest(request: CreatePollRequest): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!request.question || request.question.trim().length < 10) {
      errors.push('Question must be at least 10 characters long')
    }

    if (!request.options || request.options.length < 2) {
      errors.push('Poll must have at least 2 options')
    }

    if (request.options && request.options.length > 10) {
      warnings.push('Polls with more than 10 options may be difficult to manage')
    }

    if (!request.endTime || request.endTime <= new Date()) {
      errors.push('End time must be in the future')
    }

    if (request.endTime && request.endTime.getTime() - Date.now() < 3600000) {
      warnings.push('Polls ending in less than 1 hour may not get enough participation')
    }

    if (request.minimumStake && request.maximumStake && request.minimumStake >= request.maximumStake) {
      errors.push('Minimum stake must be less than maximum stake')
    }

    if (request.minimumStake && request.minimumStake <= 0) {
      errors.push('Minimum stake must be positive')
    }

    const confidence = errors.length === 0 ? 
      (warnings.length === 0 ? ConfidenceLevel.VERY_HIGH : ConfidenceLevel.HIGH) :
      ConfidenceLevel.LOW

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      confidence
    }
  }
}