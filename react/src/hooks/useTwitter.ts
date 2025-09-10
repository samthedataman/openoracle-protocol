import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { getDefaultAPI } from '../services/api'
import type {
  TwitterAnalysis,
  NewsEvent,
  OracleRoutingResponse,
  HookConfig,
  ApiError
} from '../types'

// ============ Twitter Analysis Types ============

export interface TwitterOracleAnalysis {
  question: string
  sentiment_analysis: {
    overall_sentiment: 'bullish' | 'bearish' | 'neutral'
    confidence: number
    key_phrases: string[]
    influencer_mentions: string[]
  }
  oracle_routing: {
    can_resolve: boolean
    provider?: string
    data_category?: string
    resolution_method?: string
  }
  suggested_options: string[]
  market_potential: number
}

export interface TwitterTrendAnalysis {
  trend_topic: string
  volume: number
  sentiment: 'positive' | 'negative' | 'neutral'
  related_keywords: string[]
  oracle_opportunities: {
    question: string
    resolvable: boolean
    confidence: number
  }[]
}

// ============ Main Twitter Hook ============

export interface UseTwitterOptions extends HookConfig {
  autoAnalyze?: boolean
}

export interface UseTwitterReturn {
  // Analysis methods
  analyzeQuestion: (question: string) => Promise<TwitterOracleAnalysis>
  analyzeTrend: (trend: string) => Promise<TwitterTrendAnalysis>
  generatePollFromTweet: (tweetData: any) => Promise<any>
  
  // Async mutations
  analyzeQuestionAsync: ReturnType<typeof useMutation<TwitterOracleAnalysis, ApiError, string>>
  analyzeTrendAsync: ReturnType<typeof useMutation<TwitterTrendAnalysis, ApiError, string>>
  generatePollAsync: ReturnType<typeof useMutation<any, ApiError, any>>
  
  // Loading states
  isAnalyzing: boolean
  isAnalyzingTrend: boolean
  isGeneratingPoll: boolean
  
  // Errors
  analysisError: ApiError | null
  trendError: ApiError | null
  generationError: ApiError | null
}

export const useTwitter = (options: UseTwitterOptions = {}): UseTwitterReturn => {
  const api = getDefaultAPI()
  
  // Question analysis mutation
  const analyzeQuestionMutation = useMutation({
    mutationFn: async (question: string): Promise<TwitterOracleAnalysis> => {
      const response = await api.analyzeTwitterQuestion(question)
      return response
    },
    retry: 1
  })
  
  // Trend analysis mutation
  const analyzeTrendMutation = useMutation({
    mutationFn: async (trend: string): Promise<TwitterTrendAnalysis> => {
      const response = await api.request({
        method: 'post',
        url: '/api/oracle/twitter/analyze-trend',
        data: { trend }
      })
      return response
    },
    retry: 1
  })
  
  // Poll generation mutation
  const generatePollMutation = useMutation({
    mutationFn: async (tweetData: any) => {
      const response = await api.request({
        method: 'post',
        url: '/api/oracle/twitter/generate-poll',
        data: tweetData
      })
      return response
    },
    retry: 1
  })
  
  // Methods
  const analyzeQuestion = useCallback(
    (question: string) => analyzeQuestionMutation.mutateAsync(question),
    [analyzeQuestionMutation]
  )
  
  const analyzeTrend = useCallback(
    (trend: string) => analyzeTrendMutation.mutateAsync(trend),
    [analyzeTrendMutation]
  )
  
  const generatePollFromTweet = useCallback(
    (tweetData: any) => generatePollMutation.mutateAsync(tweetData),
    [generatePollMutation]
  )
  
  return {
    // Methods
    analyzeQuestion,
    analyzeTrend,
    generatePollFromTweet,
    
    // Async mutations
    analyzeQuestionAsync: analyzeQuestionMutation,
    analyzeTrendAsync: analyzeTrendMutation,
    generatePollAsync: generatePollMutation,
    
    // Loading states
    isAnalyzing: analyzeQuestionMutation.isPending,
    isAnalyzingTrend: analyzeTrendMutation.isPending,
    isGeneratingPoll: generatePollMutation.isPending,
    
    // Errors
    analysisError: analyzeQuestionMutation.error,
    trendError: analyzeTrendMutation.error,
    generationError: generatePollMutation.error
  }
}

// ============ Twitter Trends Hook ============

export interface UseTwitterTrendsOptions extends HookConfig {
  location?: string
  limit?: number
}

export const useTwitterTrends = (options: UseTwitterTrendsOptions = {}) => {
  const api = getDefaultAPI()
  const { location = 'global', limit = 20, ...queryOptions } = options
  
  return useQuery({
    queryKey: ['twitter-trends', location, limit],
    queryFn: () => api.request({
      url: '/api/oracle/twitter/trends',
      params: { location, limit }
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // 10 minutes
    enabled: options.enabled !== false,
    ...queryOptions
  })
}

// ============ News to Poll Hook ============

export interface UseNewsAnalysisOptions extends HookConfig {
  autoGenerate?: boolean
}

export const useNewsAnalysis = (options: UseNewsAnalysisOptions = {}) => {
  const api = getDefaultAPI()
  
  // Analyze news mutation
  const analyzeNewsMutation = useMutation({
    mutationFn: async (newsData: NewsEvent) => {
      const response = await api.analyzeNews(newsData)
      return response
    },
    retry: 1
  })
  
  // Generate poll from news mutation
  const generateFromNewsMutation = useMutation({
    mutationFn: async (newsData: NewsEvent) => {
      const response = await api.generatePollFromNews(newsData)
      return response
    },
    retry: 1
  })
  
  const analyzeNews = useCallback(
    (newsData: NewsEvent) => analyzeNewsMutation.mutateAsync(newsData),
    [analyzeNewsMutation]
  )
  
  const generatePollFromNews = useCallback(
    (newsData: NewsEvent) => generateFromNewsMutation.mutateAsync(newsData),
    [generateFromNewsMutation]
  )
  
  return {
    analyzeNews,
    generatePollFromNews,
    analyzeNewsAsync: analyzeNewsMutation,
    generateFromNewsAsync: generateFromNewsMutation,
    isAnalyzingNews: analyzeNewsMutation.isPending,
    isGeneratingFromNews: generateFromNewsMutation.isPending,
    newsAnalysisError: analyzeNewsMutation.error,
    newsGenerationError: generateFromNewsMutation.error
  }
}

// ============ Sentiment Analysis Hook ============

export interface UseSentimentAnalysisOptions extends HookConfig {
  threshold?: number
}

export const useSentimentAnalysis = (options: UseSentimentAnalysisOptions = {}) => {
  const api = getDefaultAPI()
  
  const analyzeSentimentMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await api.request({
        method: 'post',
        url: '/api/ai/sentiment',
        data: { text, threshold: options.threshold || 0.7 }
      })
      return response
    },
    retry: 1
  })
  
  const analyzeSentiment = useCallback(
    (text: string) => analyzeSentimentMutation.mutateAsync(text),
    [analyzeSentimentMutation]
  )
  
  const getBulkSentiment = useCallback(
    async (texts: string[]) => {
      const response = await api.request({
        method: 'post',
        url: '/api/ai/sentiment/bulk',
        data: { texts, threshold: options.threshold || 0.7 }
      })
      return response
    },
    [api, options.threshold]
  )
  
  return {
    analyzeSentiment,
    getBulkSentiment,
    analyzeSentimentAsync: analyzeSentimentMutation,
    isAnalyzing: analyzeSentimentMutation.isPending,
    error: analyzeSentimentMutation.error
  }
}

// ============ Content Extraction Hook ============

export interface ContentExtractionRequest {
  url?: string
  text?: string
  html?: string
  type: 'url' | 'text' | 'html'
}

export const useContentExtraction = () => {
  const api = getDefaultAPI()
  
  const extractContentMutation = useMutation({
    mutationFn: async (request: ContentExtractionRequest) => {
      const response = await api.request({
        method: 'post',
        url: '/api/extension/extract-content',
        data: request
      })
      return response
    },
    retry: 1
  })
  
  const extractContent = useCallback(
    (request: ContentExtractionRequest) => extractContentMutation.mutateAsync(request),
    [extractContentMutation]
  )
  
  // Utility methods for different content types
  const extractFromUrl = useCallback(
    (url: string) => extractContent({ url, type: 'url' }),
    [extractContent]
  )
  
  const extractFromText = useCallback(
    (text: string) => extractContent({ text, type: 'text' }),
    [extractContent]
  )
  
  const extractFromHtml = useCallback(
    (html: string) => extractContent({ html, type: 'html' }),
    [extractContent]
  )
  
  return {
    extractContent,
    extractFromUrl,
    extractFromText,
    extractFromHtml,
    extractContentAsync: extractContentMutation,
    isExtracting: extractContentMutation.isPending,
    error: extractContentMutation.error
  }
}

// ============ AI-Powered Question Generation Hook ============

export interface QuestionGenerationOptions {
  context?: string
  category?: string
  sentiment?: 'bullish' | 'bearish' | 'neutral'
  oracle_resolvable?: boolean
  max_questions?: number
}

export const useQuestionGeneration = () => {
  const api = getDefaultAPI()
  
  const generateQuestionsMutation = useMutation({
    mutationFn: async (options: QuestionGenerationOptions) => {
      const response = await api.request({
        method: 'post',
        url: '/api/ai/generate-questions',
        data: options
      })
      return response
    },
    retry: 1
  })
  
  const generateQuestions = useCallback(
    (options: QuestionGenerationOptions) => generateQuestionsMutation.mutateAsync(options),
    [generateQuestionsMutation]
  )
  
  // Specialized question generation methods
  const generateFromNews = useCallback(
    (newsData: NewsEvent, maxQuestions: number = 3) => generateQuestions({
      context: `${newsData.title}\n${newsData.content}`,
      category: newsData.categories[0],
      oracle_resolvable: true,
      max_questions: maxQuestions
    }),
    [generateQuestions]
  )
  
  const generateFromTrend = useCallback(
    (trend: string, sentiment?: 'bullish' | 'bearish' | 'neutral') => generateQuestions({
      context: trend,
      sentiment,
      oracle_resolvable: true,
      max_questions: 5
    }),
    [generateQuestions]
  )
  
  return {
    generateQuestions,
    generateFromNews,
    generateFromTrend,
    generateQuestionsAsync: generateQuestionsMutation,
    isGenerating: generateQuestionsMutation.isPending,
    error: generateQuestionsMutation.error
  }
}