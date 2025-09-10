import { z } from 'zod';

// Enums from Python SDK
export const TokenType = z.enum(['FLOW', 'USDC', 'PYUSD', 'DAI', 'USDT']);
export const PollStatus = z.enum(['active', 'ended', 'resolved', 'cancelled']);
export const Perspective = z.enum(['balanced', 'cynic', 'optimist']);
export const BettingTier = z.enum(['early_bird', 'quick', 'normal', 'base']);

export const PollType = z.enum([
  'trending', 'breaking_news', 'new', 'featured', 'hot', 
  'controversial', 'ending_soon', 'high_stakes', 'expert', 'community'
]);

export const PollCategory = z.enum([
  'all', 'politics', 'elections', 'sports', 'crypto', 'tech', 'economy',
  'geopolitics', 'culture', 'world', 'entertainment', 'health', 'environment',
  'social_media', 'science', 'business', 'education', 'legal', 'military',
  'energy', 'real_estate'
]);

// Poll Perspective Types (Enhanced)
export const PollPerspective = z.enum(['bull', 'bear', 'chaos']);
export const OptionArchetype = z.enum([
  'moon_shot', 'steady_growth', 'silver_lining',
  'total_disaster', 'slow_decline', 'hidden_cost',
  'plot_twist', 'black_swan', 'wildcard'
]);

// Article Data Schema
export const ArticleDataSchema = z.object({
  url: z.string().url(),
  title: z.string().min(5).max(500),
  summary: z.string().max(2000).optional(),
  content: z.string().max(10000).optional(),
  author: z.string().max(200).optional(),
  published_date: z.string().datetime().optional(),
  news_site: z.string(),
  tags: z.array(z.string()).default([])
});

// Tweet Data Schema
export const TweetDataSchema = z.object({
  url: z.string().url(),
  tweet_id: z.string(),
  content: z.string().min(1).max(10000),
  author: z.string(),
  replies: z.array(z.string()).default([]),
  timestamp: z.string().datetime().optional()
});

// Enhanced Poll Option Schema
export const EnhancedPollOptionSchema = z.object({
  text: z.string().min(5).max(150),
  perspective: PollPerspective,
  archetype: OptionArchetype,
  emoji: z.string().default(''),
  hashtag: z.string().default(''),
  expected_percentage: z.number().min(0).max(100),
  volatility_score: z.number().min(0).max(1).default(0.5),
  conviction_level: z.number().min(0).max(1).default(0.5),
  reasoning: z.string(),
  trigger_event: z.string().optional()
});

// Binary Poll Option Schema
export const BinaryPollOptionSchema = z.object({
  text: z.string(),
  value: z.boolean(),
  reasoning: z.string(),
  expected_percentage: z.number().min(0).max(100)
});

// Article Context Schema
export const ArticleContextSchema = z.object({
  category: z.string(),
  sentiment: z.number().min(-1).max(1),
  urgency: z.number().min(0).max(1),
  controversy_level: z.number().min(0).max(1),
  key_entities: z.array(z.string()).default([]),
  time_horizon: z.enum(['hours', 'days', 'weeks', 'months']),
  market_impact: z.enum(['low', 'medium', 'high', 'extreme'])
});

// Viral Poll Response Schema
export const ViralPollResponseSchema = z.object({
  question: z.string().min(10).max(500),
  serial_optimism: z.string(),
  contrarian: z.string(),
  pessimistic: z.string(),
  hottake: z.string(),
  options: z.array(z.string()).min(4).max(4),
  metadata: z.object({
    viral_score: z.number().min(0).max(1),
    share_text: z.string(),
    hashtags: z.array(z.string()),
    engagement_hooks: z.array(z.string()),
    psychological_triggers: z.array(z.string()),
    expected_shares: z.number(),
    expected_engagement_rate: z.number().min(0).max(1)
  }),
  strategy: z.object({
    template: z.enum(['outcome', 'magnitude', 'timing', 'reaction', 'comparison']),
    perspectives: z.array(PollPerspective),
    target_audience: z.enum(['crypto_natives', 'mainstream', 'experts', 'gamblers'])
  }),
  category: z.string()
});

// Twitter Binary Poll Response Schema
export const TwitterBinaryPollResponseSchema = z.object({
  question: z.string().min(10).max(500),
  options: z.array(BinaryPollOptionSchema).length(2),
  category: PollCategory.default('social_media'),
  poll_type: z.enum(['binary', 'prediction']).default('binary'),
  confidence_level: z.number().min(0).max(1),
  reasoning: z.string(),
  tags: z.array(z.string()).max(5),
  resolution_timeframe: z.string()
});

// Poll Generation Request Schemas
export const PollGenerationRequestSchema = z.object({
  article_data: ArticleDataSchema,
  perspective: Perspective.default('balanced'),
  payment_token: TokenType.default('FLOW'),
  custom_question: z.string().optional()
});

export const TwitterPollRequestSchema = z.object({
  tweet_data: TweetDataSchema,
  poll_type: z.enum(['binary', 'prediction']).default('binary'),
  custom_question: z.string().optional()
});

// Types derived from schemas
export type ArticleData = z.infer<typeof ArticleDataSchema>;
export type TweetData = z.infer<typeof TweetDataSchema>;
export type EnhancedPollOption = z.infer<typeof EnhancedPollOptionSchema>;
export type BinaryPollOption = z.infer<typeof BinaryPollOptionSchema>;
export type ArticleContext = z.infer<typeof ArticleContextSchema>;
export type ViralPollResponse = z.infer<typeof ViralPollResponseSchema>;
export type TwitterBinaryPollResponse = z.infer<typeof TwitterBinaryPollResponseSchema>;
export type PollGenerationRequest = z.infer<typeof PollGenerationRequestSchema>;
export type TwitterPollRequest = z.infer<typeof TwitterPollRequestSchema>;