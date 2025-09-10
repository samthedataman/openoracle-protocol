/**
 * Twitter API Client - Social media oracle integration
 */

import { OracleClient } from '../core/client'
import { OracleConfig } from '../core/config'
import { DataCategory, ConfidenceLevel } from '../types/enums'
import { OracleDataPoint, OraclePollData } from '../schemas/oracle-schemas'
import { ValidationError, AuthenticationError } from '../core/exceptions'

export interface TwitterSearchOptions {
  query: string
  maxResults?: number
  tweetFields?: string[]
  userFields?: string[]
  expansions?: string[]
  startTime?: Date
  endTime?: Date
  lang?: string
}

export interface TwitterUserMetrics {
  followersCount: number
  followingCount: number
  tweetCount: number
  listedCount: number
  verifiedType?: string
  publicMetrics: {
    followers: number
    following: number
    tweets: number
    listed: number
  }
}

export interface TwitterTweet {
  id: string
  text: string
  authorId: string
  createdAt: Date
  publicMetrics: {
    retweetCount: number
    replyCount: number
    likeCount: number
    quoteCount: number
    bookmarkCount?: number
    impressionCount?: number
  }
  contextAnnotations?: Array<{
    domain: { id: string; name: string; description: string }
    entity: { id: string; name: string; description: string }
  }>
  referencedTweets?: Array<{
    type: 'retweeted' | 'quoted' | 'replied_to'
    id: string
  }>
  attachments?: {
    mediaKeys?: string[]
    pollIds?: string[]
  }
  sentiment?: {
    label: 'positive' | 'negative' | 'neutral'
    score: number
  }
  entities?: {
    hashtags?: Array<{ start: number; end: number; tag: string }>
    mentions?: Array<{ start: number; end: number; username: string; id: string }>
    urls?: Array<{ start: number; end: number; url: string; expandedUrl: string }>
    cashtags?: Array<{ start: number; end: number; tag: string }>
  }
}

export interface TwitterAnalysisResult {
  query: string
  tweets: TwitterTweet[]
  totalCount: number
  sentiment: {
    positive: number
    negative: number
    neutral: number
    overall: 'positive' | 'negative' | 'neutral'
    confidence: ConfidenceLevel
  }
  trends: Array<{
    topic: string
    mentions: number
    sentiment: number
    velocity: number
  }>
  influencers: Array<{
    userId: string
    username: string
    influence: number
    reach: number
    engagement: number
  }>
  predictionMarkers: Array<{
    text: string
    confidence: number
    category: DataCategory
    extractedValue?: string | number
  }>
}

export interface TwitterPredictionRequest {
  tweetId?: string
  query?: string
  category: DataCategory
  timeframe?: string
  options?: string[]
  endTime?: Date
}

export class TwitterAPI {
  private readonly client: OracleClient
  private readonly config: OracleConfig

  constructor(client: OracleClient, config: OracleConfig) {
    this.client = client
    this.config = config
    this.validateTwitterConfig()
  }

  private validateTwitterConfig(): void {
    if (!this.config.apiKeys.twitter?.bearerToken && !this.config.apiKeys.twitter?.apiKey) {
      throw new AuthenticationError('Twitter API credentials are required')
    }
  }

  /**
   * Search tweets for oracle data
   */
  async searchTweets(options: TwitterSearchOptions): Promise<TwitterTweet[]> {
    if (!options.query) {
      throw new ValidationError('Search query is required')
    }

    const response = await this.client.post('/api/twitter/search', {
      query: options.query,
      max_results: options.maxResults || 100,
      tweet_fields: options.tweetFields || ['public_metrics', 'created_at', 'context_annotations'],
      user_fields: options.userFields || ['public_metrics', 'verified_type'],
      expansions: options.expansions || ['author_id'],
      start_time: options.startTime?.toISOString(),
      end_time: options.endTime?.toISOString(),
      lang: options.lang || 'en'
    })

    return response.data?.tweets || []
  }

  /**
   * Analyze sentiment from tweets
   */
  async analyzeSentiment(
    query: string,
    options?: {
      maxTweets?: number
      timeRange?: { from: Date; to: Date }
      includeRetweets?: boolean
      lang?: string
    }
  ): Promise<TwitterAnalysisResult> {
    const response = await this.client.post('/api/twitter/sentiment', {
      query,
      max_tweets: options?.maxTweets || 500,
      start_time: options?.timeRange?.from?.toISOString(),
      end_time: options?.timeRange?.to?.toISOString(),
      include_retweets: options?.includeRetweets ?? false,
      lang: options?.lang || 'en'
    })

    return response.data
  }

  /**
   * Extract prediction markets from tweets
   */
  async extractPredictions(
    query: string,
    category: DataCategory,
    options?: {
      timeframe?: string
      confidence?: number
      maxTweets?: number
    }
  ): Promise<Array<{
    prediction: string
    confidence: number
    supportingTweets: TwitterTweet[]
    extractedData: OracleDataPoint[]
  }>> {
    const response = await this.client.post('/api/twitter/predictions', {
      query,
      category,
      timeframe: options?.timeframe,
      min_confidence: options?.confidence || 0.6,
      max_tweets: options?.maxTweets || 200
    })

    return response.data || []
  }

  /**
   * Create prediction market from tweet
   */
  async createPredictionFromTweet(request: TwitterPredictionRequest): Promise<OraclePollData> {
    if (!request.tweetId && !request.query) {
      throw new ValidationError('Either tweet ID or query is required')
    }

    const response = await this.client.post('/api/twitter/create-prediction', request)
    return response.data
  }

  /**
   * Get trending topics relevant to oracle queries
   */
  async getTrendingTopics(
    location?: string,
    category?: DataCategory
  ): Promise<Array<{
    topic: string
    volume: number
    category: DataCategory
    relevanceScore: number
    predictiveValue: number
  }>> {
    const response = await this.client.get('/api/twitter/trends', {
      params: {
        location: location || 'worldwide',
        category
      }
    })

    return response.data || []
  }

  /**
   * Analyze user influence and credibility
   */
  async analyzeUser(
    username: string
  ): Promise<{
    user: {
      id: string
      username: string
      displayName: string
      description: string
      metrics: TwitterUserMetrics
      verified: boolean
      createdAt: Date
    }
    influence: {
      score: number
      rank: string
      expertise: string[]
      credibility: number
      networkReach: number
    }
    predictionHistory: Array<{
      prediction: string
      date: Date
      outcome?: boolean
      accuracy: number
    }>
  }> {
    const response = await this.client.get(`/api/twitter/users/${username}/analysis`)
    return response.data
  }

  /**
   * Monitor real-time mentions and hashtags
   */
  async monitorMentions(
    keywords: string[],
    callback: (tweet: TwitterTweet) => void,
    options?: {
      includeRetweets?: boolean
      lang?: string
      sentiment?: boolean
    }
  ): Promise<EventSource> {
    const params = new URLSearchParams({
      keywords: keywords.join(','),
      include_retweets: (options?.includeRetweets ?? false).toString(),
      lang: options?.lang || 'en',
      sentiment: (options?.sentiment ?? true).toString()
    })

    return this.client.createEventStream(`/api/twitter/stream/mentions?${params}`, {
      onData: callback,
      onError: (error) => {
        console.error('Twitter stream error:', error)
      }
    })
  }

  /**
   * Get Twitter-based market confidence indicators
   */
  async getMarketConfidence(
    query: string,
    timeRange: { from: Date; to: Date }
  ): Promise<{
    confidence: ConfidenceLevel
    indicators: {
      volume: number
      sentiment: number
      expertMentions: number
      virality: number
      credibilityScore: number
    }
    signals: Array<{
      type: 'bullish' | 'bearish' | 'neutral'
      strength: number
      source: string
      timestamp: Date
    }>
    recommendation: {
      action: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'
      confidence: number
      reasoning: string
    }
  }> {
    const response = await this.client.post('/api/twitter/market-confidence', {
      query,
      start_time: timeRange.from.toISOString(),
      end_time: timeRange.to.toISOString()
    })

    return response.data
  }

  /**
   * Extract numeric predictions from tweets
   */
  async extractNumericPredictions(
    query: string,
    targetMetric: string,
    options?: {
      timeframe?: string
      currency?: string
      unit?: string
      minConfidence?: number
    }
  ): Promise<Array<{
    value: number
    unit: string
    confidence: number
    source: TwitterTweet
    reasoning: string
    timeframe?: string
  }>> {
    const response = await this.client.post('/api/twitter/numeric-predictions', {
      query,
      target_metric: targetMetric,
      timeframe: options?.timeframe,
      currency: options?.currency,
      unit: options?.unit,
      min_confidence: options?.minConfidence || 0.5
    })

    return response.data || []
  }

  /**
   * Get Twitter-based event predictions
   */
  async getEventPredictions(
    eventQuery: string,
    category: DataCategory,
    timeHorizon: string
  ): Promise<{
    event: string
    probability: number
    confidence: ConfidenceLevel
    timeframe: string
    supportingEvidence: Array<{
      tweet: TwitterTweet
      relevance: number
      sentiment: number
      credibilityScore: number
    }>
    counterEvidence: Array<{
      tweet: TwitterTweet
      relevance: number
      sentiment: number
      credibilityScore: number
    }>
    aggregatedPrediction: {
      outcome: boolean
      probability: number
      reasoning: string
    }
  }> {
    const response = await this.client.post('/api/twitter/event-predictions', {
      event_query: eventQuery,
      category,
      time_horizon: timeHorizon
    })

    return response.data
  }

  /**
   * Create custom Twitter-based oracle feed
   */
  async createTwitterFeed(
    feedConfig: {
      name: string
      queries: string[]
      category: DataCategory
      updateFrequency: string
      sentimentWeight: number
      volumeWeight: number
      credibilityWeight: number
      aggregationMethod: 'sentiment' | 'volume' | 'expert' | 'hybrid'
    }
  ): Promise<{ feedId: string }> {
    const response = await this.client.post('/api/twitter/feeds', feedConfig)
    return response.data
  }

  /**
   * Get historical Twitter sentiment data
   */
  async getHistoricalSentiment(
    query: string,
    timeRange: { from: Date; to: Date },
    interval: '1h' | '6h' | '1d' | '1w' = '1d'
  ): Promise<Array<{
    timestamp: Date
    sentiment: {
      positive: number
      negative: number
      neutral: number
      overall: number
    }
    volume: number
    reach: number
    engagement: number
  }>> {
    const response = await this.client.get('/api/twitter/historical-sentiment', {
      params: {
        query,
        from: timeRange.from.toISOString(),
        to: timeRange.to.toISOString(),
        interval
      }
    })

    return response.data || []
  }
}