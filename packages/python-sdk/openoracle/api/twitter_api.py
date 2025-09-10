"""
Twitter integration API methods
Handles tweet analysis and prediction market creation from social media
"""

from typing import Dict, Any, Optional, List
import logging

from ..core.client import OpenOracleClient

logger = logging.getLogger(__name__)


class TwitterAPI:
    """API methods for Twitter integration and analysis"""
    
    def __init__(self, client: OpenOracleClient):
        self.client = client
    
    # ============ Tweet Analysis ============
    
    async def analyze_tweet(self, tweet_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze a tweet for prediction market potential
        
        Args:
            tweet_data: Dictionary containing tweet information:
                - content: Tweet text content
                - author: Tweet author (optional)
                - tweet_id: Tweet ID (optional)
                - timestamp: Tweet timestamp (optional)
                - engagement: Engagement metrics (optional)
        
        Returns:
            Analysis results with prediction market suggestions
        """
        response = await self.client.post('/api/oracle/twitter/analyze', json_data=tweet_data)
        return response
    
    async def extract_predictions_from_tweet(self, tweet_content: str) -> List[Dict[str, Any]]:
        """Extract potential predictions from tweet content"""
        response = await self.client.post('/api/oracle/twitter/extract-predictions', json_data={
            'content': tweet_content
        })
        return response.get('predictions', [])
    
    async def analyze_tweet_sentiment(self, tweet_content: str) -> Dict[str, Any]:
        """Analyze sentiment of a tweet"""
        response = await self.client.post('/api/oracle/twitter/sentiment', json_data={
            'content': tweet_content
        })
        return response
    
    async def detect_tweet_intent(self, tweet_content: str) -> Dict[str, Any]:
        """Detect the intent behind a tweet (prediction, claim, opinion, etc.)"""
        response = await self.client.post('/api/oracle/twitter/intent', json_data={
            'content': tweet_content
        })
        return response
    
    # ============ Author Analysis ============
    
    async def analyze_author_credibility(
        self,
        author: str,
        topic: Optional[str] = None
    ) -> Dict[str, Any]:
        """Analyze the credibility of a tweet author in a specific domain"""
        params = {'author': author}
        if topic:
            params['topic'] = topic
        
        response = await self.client.get('/api/oracle/twitter/author/credibility', params=params)
        return response
    
    async def get_author_prediction_history(self, author: str) -> Dict[str, Any]:
        """Get historical prediction accuracy for an author"""
        response = await self.client.get(f'/api/oracle/twitter/author/{author}/history')
        return response
    
    async def analyze_author_expertise(
        self,
        author: str,
        categories: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Analyze author expertise in specific categories"""
        params = {'author': author}
        if categories:
            params['categories'] = ','.join(categories)
        
        response = await self.client.get('/api/oracle/twitter/author/expertise', params=params)
        return response
    
    # ============ Content Processing ============
    
    async def extract_entities_from_tweet(self, tweet_content: str) -> Dict[str, Any]:
        """Extract named entities from tweet content"""
        response = await self.client.post('/api/oracle/twitter/entities', json_data={
            'content': tweet_content
        })
        return response
    
    async def extract_prices_from_tweet(self, tweet_content: str) -> List[Dict[str, Any]]:
        """Extract price mentions from tweet content"""
        response = await self.client.post('/api/oracle/twitter/prices', json_data={
            'content': tweet_content
        })
        return response.get('prices', [])
    
    async def extract_dates_from_tweet(self, tweet_content: str) -> List[Dict[str, Any]]:
        """Extract date mentions from tweet content"""
        response = await self.client.post('/api/oracle/twitter/dates', json_data={
            'content': tweet_content
        })
        return response.get('dates', [])
    
    async def classify_tweet_category(self, tweet_content: str) -> Dict[str, Any]:
        """Classify tweet into prediction market categories"""
        response = await self.client.post('/api/oracle/twitter/classify', json_data={
            'content': tweet_content
        })
        return response
    
    # ============ Question Generation ============
    
    async def generate_question_from_tweet(
        self,
        tweet_content: str,
        author: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Generate a prediction market question from tweet content"""
        request_data = {'content': tweet_content}
        if author:
            request_data['author'] = author
        if context:
            request_data['context'] = context
        
        response = await self.client.post('/api/oracle/twitter/generate-question', json_data=request_data)
        return response
    
    async def refine_question(
        self,
        question: str,
        tweet_context: str,
        feedback: Optional[str] = None
    ) -> Dict[str, Any]:
        """Refine a generated question based on context and feedback"""
        response = await self.client.post('/api/oracle/twitter/refine-question', json_data={
            'question': question,
            'tweet_context': tweet_context,
            'feedback': feedback
        })
        return response
    
    async def suggest_question_variants(self, base_question: str) -> List[str]:
        """Generate alternative formulations of a question"""
        response = await self.client.post('/api/oracle/twitter/question-variants', json_data={
            'question': base_question
        })
        return response.get('variants', [])
    
    # ============ Market Creation from Tweets ============
    
    async def create_market_from_tweet(
        self,
        tweet_data: Dict[str, Any],
        poll_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create a prediction market directly from tweet data"""
        request_data = {
            'tweet_data': tweet_data,
            'poll_config': poll_config or {}
        }
        
        response = await self.client.post('/api/oracle/twitter/create-market', json_data=request_data)
        return response
    
    async def validate_tweet_for_market(self, tweet_content: str) -> Dict[str, Any]:
        """Validate if a tweet is suitable for creating a prediction market"""
        response = await self.client.post('/api/oracle/twitter/validate-market', json_data={
            'content': tweet_content
        })
        return response
    
    async def estimate_market_parameters(
        self,
        tweet_content: str,
        author: Optional[str] = None
    ) -> Dict[str, Any]:
        """Estimate optimal parameters for a market based on tweet"""
        request_data = {'content': tweet_content}
        if author:
            request_data['author'] = author
        
        response = await self.client.post('/api/oracle/twitter/estimate-parameters', json_data=request_data)
        return response
    
    # ============ Thread and Context Analysis ============
    
    async def analyze_tweet_thread(self, thread_tweets: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze an entire tweet thread for context and predictions"""
        response = await self.client.post('/api/oracle/twitter/analyze-thread', json_data={
            'tweets': thread_tweets
        })
        return response
    
    async def get_tweet_context(self, tweet_id: str) -> Dict[str, Any]:
        """Get context information for a tweet (replies, quotes, etc.)"""
        response = await self.client.get(f'/api/oracle/twitter/context/{tweet_id}')
        return response
    
    async def analyze_conversation(self, conversation_id: str) -> Dict[str, Any]:
        """Analyze an entire Twitter conversation for prediction opportunities"""
        response = await self.client.get(f'/api/oracle/twitter/conversation/{conversation_id}')
        return response
    
    # ============ Trending and Discovery ============
    
    async def get_trending_predictions(
        self,
        timeframe: str = "24h",
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get trending prediction topics from Twitter"""
        params = {'timeframe': timeframe}
        if category:
            params['category'] = category
        
        response = await self.client.get('/api/oracle/twitter/trending', params=params)
        return response.get('predictions', [])
    
    async def discover_prediction_opportunities(
        self,
        keywords: Optional[List[str]] = None,
        authors: Optional[List[str]] = None,
        min_engagement: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Discover potential prediction market opportunities from Twitter"""
        params = {}
        if keywords:
            params['keywords'] = ','.join(keywords)
        if authors:
            params['authors'] = ','.join(authors)
        if min_engagement:
            params['min_engagement'] = min_engagement
        
        response = await self.client.get('/api/oracle/twitter/discover', params=params)
        return response.get('opportunities', [])
    
    async def monitor_hashtags(self, hashtags: List[str]) -> Dict[str, Any]:
        """Monitor specific hashtags for prediction market opportunities"""
        response = await self.client.post('/api/oracle/twitter/monitor-hashtags', json_data={
            'hashtags': hashtags
        })
        return response
    
    # ============ Social Signals ============
    
    async def analyze_social_signals(self, tweet_id: str) -> Dict[str, Any]:
        """Analyze social signals (likes, retweets, replies) for market insight"""
        response = await self.client.get(f'/api/oracle/twitter/social-signals/{tweet_id}')
        return response
    
    async def predict_viral_potential(self, tweet_content: str) -> Dict[str, Any]:
        """Predict the viral potential of tweet content"""
        response = await self.client.post('/api/oracle/twitter/viral-potential', json_data={
            'content': tweet_content
        })
        return response
    
    async def analyze_community_sentiment(
        self,
        topic: str,
        timeframe: str = "24h"
    ) -> Dict[str, Any]:
        """Analyze overall community sentiment around a topic"""
        response = await self.client.get('/api/oracle/twitter/community-sentiment', params={
            'topic': topic,
            'timeframe': timeframe
        })
        return response
    
    # ============ Real-time Monitoring ============
    
    async def setup_tweet_monitoring(
        self,
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Set up real-time monitoring of tweets matching filters"""
        response = await self.client.post('/api/oracle/twitter/monitor/setup', json_data=filters)
        return response
    
    async def get_monitoring_results(self, monitor_id: str) -> Dict[str, Any]:
        """Get results from a tweet monitoring session"""
        response = await self.client.get(f'/api/oracle/twitter/monitor/{monitor_id}/results')
        return response
    
    async def stop_tweet_monitoring(self, monitor_id: str) -> Dict[str, Any]:
        """Stop a tweet monitoring session"""
        response = await self.client.delete(f'/api/oracle/twitter/monitor/{monitor_id}')
        return response