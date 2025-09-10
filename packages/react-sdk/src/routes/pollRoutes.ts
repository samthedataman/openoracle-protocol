import { AIRoute } from '../types/ai';
import { 
  ArticleDataSchema, 
  TweetDataSchema, 
  ViralPollResponseSchema, 
  TwitterBinaryPollResponseSchema,
  PollGenerationRequestSchema,
  TwitterPollRequestSchema,
  ArticleContextSchema
} from '../schemas/poll';

/**
 * Route for generating viral polls from articles
 */
export const generateViralPollRoute: AIRoute = {
  path: '/poll/generate-viral',
  description: 'Generate a viral prediction market poll from news article content',
  inputSchema: PollGenerationRequestSchema,
  outputSchema: ViralPollResponseSchema,
  systemPrompt: `You are PolyPoll AI, an expert at creating viral prediction markets that maximize engagement and betting volume.

Your role is to transform news articles into compelling 4-option polls with distinct perspectives:
1. SERIAL OPTIMISM (🚀) - Ultra bullish, best-case scenario
2. CONTRARIAN (🔄) - Against mainstream narrative, unexpected twist  
3. PESSIMISTIC (💀) - Significant downside, realistic risks
4. HOT TAKE (🔥) - Bold, controversial but possible outcome

Requirements:
- Create specific, measurable predictions with numbers/timeframes
- Make options mutually exclusive and resolvable within 24-48 hours
- Use engaging language that sparks debate and FOMO
- Include concrete details from the article
- Balance realism with excitement to drive betting volume

Always respond with valid JSON matching the expected schema.`,
  temperature: 0.8,
  maxTokens: 1000,
  examples: [
    {
      input: {
        article_data: {
          url: 'https://example.com/fed-meeting',
          title: 'Fed Announces Emergency Rate Decision Meeting',
          summary: 'Federal Reserve calls surprise meeting amid inflation concerns',
          news_site: 'financial-news.com',
          tags: ['fed', 'rates', 'economy']
        },
        perspective: 'balanced',
        payment_token: 'FLOW'
      },
      output: {
        question: '🎯 Fed emergency meeting - rate shock or market calm?',
        serial_optimism: 'Fed cuts rates 75bp, markets surge 8%+',
        contrarian: 'Meeting cancelled, no changes made',
        pessimistic: 'Emergency 100bp hike triggers recession',
        hottake: 'Fed chair resigns during announcement',
        options: [
          'Fed cuts rates 75bp, markets surge 8%+',
          'Meeting cancelled, no changes made', 
          'Emergency 100bp hike triggers recession',
          'Fed chair resigns during announcement'
        ],
        metadata: {
          viral_score: 0.89,
          share_text: '🔥 Fed emergency meeting - chaos incoming! My bet: Fed chair resigns 🤯',
          hashtags: ['#FedMeeting', '#RateShock', '#MarketChaos'],
          engagement_hooks: ['⚡ Breaking: Fed emergency meeting in 2 hours!'],
          psychological_triggers: ['fomo', 'urgency', 'controversy'],
          expected_shares: 89,
          expected_engagement_rate: 0.89
        },
        strategy: {
          template: 'outcome',
          perspectives: ['bull', 'bear', 'chaos'],
          target_audience: 'experts'
        },
        category: 'economy'
      },
      description: 'High-stakes financial news with clear market implications'
    }
  ]
};

/**
 * Route for generating binary Twitter polls
 */
export const generateTwitterPollRoute: AIRoute = {
  path: '/poll/generate-twitter',
  description: 'Generate binary Yes/No polls from Twitter/X content',
  inputSchema: TwitterPollRequestSchema,
  outputSchema: TwitterBinaryPollResponseSchema,
  systemPrompt: `You are PolyPoll AI, specialized in creating binary prediction markets from Twitter content.

Create specific, measurable Yes/No questions that can be resolved within 24-48 hours.

Good examples:
- "Will Elon Musk tweet about this topic again within 24 hours?"
- "Will this stock mentioned close up >5% tomorrow?"
- "Will this prediction come true by end of week?"

Bad examples:
- "Is this a good idea?" (opinion-based)
- "Will this matter in 10 years?" (too long timeframe)

Focus on concrete, observable outcomes that create clear betting opportunities.

Always respond with valid JSON matching the expected schema.`,
  temperature: 0.7,
  maxTokens: 600,
  examples: [
    {
      input: {
        tweet_data: {
          url: 'https://twitter.com/elonmusk/status/123',
          tweet_id: '123',
          content: 'Tesla FSD will be ready for unsupervised driving by end of year',
          author: 'elonmusk',
          replies: ['Sure Elon, like every other year', 'This time feels different']
        },
        poll_type: 'binary'
      },
      output: {
        question: 'Will Tesla release unsupervised FSD to public by Dec 31?',
        options: [
          {
            text: 'Yes',
            value: true,
            reasoning: 'Tesla has been rapidly improving FSD capabilities',
            expected_percentage: 35
          },
          {
            text: 'No', 
            value: false,
            reasoning: 'Technical and regulatory hurdles remain significant',
            expected_percentage: 65
          }
        ],
        category: 'tech',
        poll_type: 'binary',
        confidence_level: 0.8,
        reasoning: 'Clear deadline and measurable outcome make this resolvable',
        tags: ['tesla', 'fsd', 'elon-musk'],
        resolution_timeframe: '3 months'
      },
      description: 'Tech prediction with clear deadline'
    }
  ]
};

/**
 * Route for analyzing article context
 */
export const analyzeArticleContextRoute: AIRoute = {
  path: '/analysis/article-context',
  description: 'Analyze article context for poll generation strategy',
  inputSchema: ArticleDataSchema,
  outputSchema: ArticleContextSchema,
  systemPrompt: `You are a news analysis expert. Analyze articles to determine optimal poll generation strategy.

Assess these dimensions:
- sentiment: How positive/negative is the article? (-1 to 1)
- urgency: How time-sensitive is this news? (0 to 1) 
- controversy_level: How divisive is this topic? (0 to 1)
- market_impact: Expected market/economic impact
- time_horizon: When can outcomes be resolved?

High urgency = breaking news, earnings, decisions happening soon
High controversy = polarizing topics that split opinion
Market impact = how much this affects markets/economy

Always respond with valid JSON matching the expected schema.`,
  temperature: 0.3,
  maxTokens: 300
};

/**
 * Utility function to get all poll-related routes
 */
export const getPollRoutes = () => ({
  generateViralPoll: generateViralPollRoute,
  generateTwitterPoll: generateTwitterPollRoute, 
  analyzeArticleContext: analyzeArticleContextRoute
});

/**
 * Route registry for easy access
 */
export const POLL_ROUTES = {
  GENERATE_VIRAL: 'generate-viral-poll',
  GENERATE_TWITTER: 'generate-twitter-poll',
  ANALYZE_CONTEXT: 'analyze-article-context'
} as const;