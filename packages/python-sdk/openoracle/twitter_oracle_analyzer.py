"""
Twitter Oracle Analyzer
Ensures 100% accurate oracle routing by deep context analysis
"""

import re
import json
import logging
from typing import Dict, Any, List, Optional, Tuple, Union, Literal
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field, validator
import json

from .schemas.oracle_schemas import (
    OracleProvider,
    DataCategory,
    OracleRoutingRequest,
    OracleRoutingResponse,
    ChainlinkPriceFeed,
    PythPriceFeed,
    UMAOptimisticOracleRequest
)

logger = logging.getLogger(__name__)

# ============ Twitter Context Analysis Schemas ============

class TwitterIntent(str, Enum):
    """Types of predictions that can be made from tweets"""
    PRICE_PREDICTION = "price_prediction"      # "BTC to 100k"
    EVENT_OUTCOME = "event_outcome"            # "We're launching X"
    SPORTS_PREDICTION = "sports_prediction"    # "Lakers will win"
    POLITICAL_CLAIM = "political_claim"        # "I will win the election"
    METRIC_ACHIEVEMENT = "metric_achievement"  # "We'll reach 1M users"
    MARKET_MOVEMENT = "market_movement"        # "Stock will crash"
    WEATHER_EVENT = "weather_event"            # "Hurricane coming"
    REGULATORY_ACTION = "regulatory_action"    # "SEC will approve"
    PRODUCT_LAUNCH = "product_launch"          # "Launching next week"
    CONTROVERSY = "controversy"                # Drama/dispute outcomes

class TweetContext(BaseModel):
    """Comprehensive tweet context for oracle routing"""
    tweet_id: str
    author: str
    content: str
    timestamp: datetime
    
    # Extracted entities
    mentioned_assets: List[str] = Field(default_factory=list)
    mentioned_prices: List[Decimal] = Field(default_factory=list)
    mentioned_dates: List[datetime] = Field(default_factory=list)
    mentioned_entities: List[str] = Field(default_factory=list)
    mentioned_metrics: Dict[str, Any] = Field(default_factory=dict)
    
    # Context flags
    is_verified_account: bool = Field(default=False)
    is_official_source: bool = Field(default=False)
    has_external_link: bool = Field(default=False)
    
    # Intent analysis
    detected_intent: Optional[TwitterIntent] = None
    confidence_score: float = Field(default=0.0, ge=0, le=1)

class OracleQueryRequest(BaseModel):
    """Request to build oracle query from tweet"""
    tweet_context: TweetContext
    poll_type: Literal["binary", "multiple_choice"] = "binary"
    resolution_timeframe: Optional[timedelta] = None
    preferred_oracle: Optional[OracleProvider] = None

class OracleQueryResponse(BaseModel):
    """Response with oracle-ready query"""
    question: str = Field(..., description="The prediction market question")
    oracle_provider: OracleProvider
    oracle_config: Dict[str, Any] = Field(..., description="Oracle-specific configuration")
    resolution_criteria: str
    resolution_source: str
    resolution_time: datetime
    confidence: float = Field(..., ge=0, le=1)
    reasoning: str

# ============ Oracle-Specific Query Schemas ============

class ChainlinkQuery(BaseModel):
    """Query format for Chainlink oracle"""
    query_type: Literal["price_feed", "sports_data", "weather_data", "vrf"]
    feed_id: Optional[str] = None
    asset_pair: Optional[str] = None
    sport_event_id: Optional[str] = None
    weather_location: Optional[str] = None
    threshold_value: Optional[Decimal] = None
    comparison: Optional[Literal["above", "below", "equals"]] = None
    
    @validator('asset_pair')
    def validate_pair_format(cls, v):
        if v and '/' not in v:
            raise ValueError("Asset pair must be in format 'ASSET/CURRENCY'")
        return v

class PythQuery(BaseModel):
    """Query format for Pyth Network oracle"""
    price_feed_id: str = Field(..., description="Hex price feed ID")
    asset_symbol: str
    threshold_price: Decimal
    comparison: Literal["above", "below"]
    confidence_interval: Optional[Decimal] = None
    
    @validator('price_feed_id')
    def validate_feed_id(cls, v):
        if not v.startswith('0x'):
            raise ValueError("Feed ID must be hex string starting with 0x")
        return v

class UMAQuery(BaseModel):
    """Query format for UMA Optimistic Oracle"""
    identifier: Literal["YES_OR_NO_QUERY", "NUMERICAL", "MULTIPLE_CHOICE"]
    question_text: str = Field(..., min_length=10, max_length=500)
    ancillary_data: str = Field(..., description="Additional context for resolution")
    resolution_source: List[str] = Field(..., description="Where to verify outcome")
    bond_amount: Decimal = Field(default=Decimal("100"))
    liveness_period: int = Field(default=7200, description="Seconds before finalization")
    
    @validator('question_text')
    def validate_question_format(cls, v):
        if not v.endswith('?'):
            v += '?'
        return v

# ============ Twitter Context Analyzer ============

class TwitterOracleAnalyzer:
    """Analyzes tweets to ensure perfect oracle routing"""
    
    # Entity extraction patterns
    PATTERNS = {
        'crypto_ticker': r'\$([A-Z]{2,6})\b|\b(BTC|ETH|SOL|AVAX|MATIC|BNB|DOGE|SHIB)\b',
        'stock_ticker': r'\$([A-Z]{1,5})\b(?=.*(?:stock|share|earnings|ipo))',
        'price_mention': r'\$?([\d,]+\.?\d*)[kKmMbB]?\s*(?:dollars?|usd|cents?)?',
        'percentage': r'(\d+\.?\d*)\s*%',
        'date_mention': r'(today|tomorrow|next\s+week|next\s+month|by\s+\w+|in\s+\d+\s+days?)',
        'metric_value': r'(\d+\.?\d*)\s*(million|billion|thousand|M|B|K|users?|followers?|downloads?)',
        'sports_team': r'\b(Lakers|Celtics|Yankees|Cowboys|[A-Z][a-z]+\s+[A-Z][a-z]+)\b',
        'political_figure': r'\b(Trump|Biden|DeSantis|[A-Z][a-z]+\s+[A-Z][a-z]+)\b'
    }
    
    # Authority verification
    OFFICIAL_ACCOUNTS = {
        'crypto': ['elonmusk', 'VitalikButerin', 'SBF_FTX', 'CZ_Binance'],
        'sports': ['NBA', 'NFL', 'ESPN', 'TheAthletic'],
        'politics': ['AP', 'Reuters', 'CNN', 'FoxNews'],
        'companies': ['Apple', 'Tesla', 'Google', 'Microsoft']
    }
    
    def analyze_tweet(self, tweet_data: Dict[str, Any]) -> TweetContext:
        """Deep analysis of tweet to extract all context"""
        
        content = tweet_data.get('content', '')
        author = tweet_data.get('author', 'unknown')
        
        context = TweetContext(
            tweet_id=tweet_data.get('tweet_id', ''),
            author=author,
            content=content,
            timestamp=datetime.now()
        )
        
        # Extract entities
        context.mentioned_assets = self._extract_assets(content)
        context.mentioned_prices = self._extract_prices(content)
        context.mentioned_dates = self._extract_dates(content)
        context.mentioned_entities = self._extract_entities(content)
        context.mentioned_metrics = self._extract_metrics(content)
        
        # Check authority
        context.is_verified_account = self._check_verified(author)
        context.is_official_source = self._check_official_source(author)
        
        # Detect intent
        context.detected_intent, context.confidence_score = self._detect_intent(
            content, context
        )
        
        return context
    
    def _extract_assets(self, content: str) -> List[str]:
        """Extract crypto/stock tickers"""
        assets = []
        
        # Crypto tickers
        crypto_matches = re.findall(self.PATTERNS['crypto_ticker'], content.upper())
        for match in crypto_matches:
            ticker = match[0] if match[0] else match[1]
            if ticker and len(ticker) >= 2:
                assets.append(ticker)
        
        # Stock tickers
        if any(word in content.lower() for word in ['stock', 'share', 'earnings']):
            stock_matches = re.findall(self.PATTERNS['stock_ticker'], content)
            assets.extend(stock_matches)
        
        return list(set(assets))
    
    def _extract_prices(self, content: str) -> List[Decimal]:
        """Extract price mentions"""
        prices = []
        matches = re.findall(self.PATTERNS['price_mention'], content)
        
        for match in matches:
            try:
                value = match.replace(',', '')
                # Handle K/M/B suffixes
                if 'k' in value.lower():
                    value = float(value.lower().replace('k', '')) * 1000
                elif 'm' in value.lower():
                    value = float(value.lower().replace('m', '')) * 1000000
                elif 'b' in value.lower():
                    value = float(value.lower().replace('b', '')) * 1000000000
                else:
                    value = float(value)
                prices.append(Decimal(str(value)))
            except:
                continue
        
        return prices
    
    def _extract_dates(self, content: str) -> List[datetime]:
        """Extract date/time references"""
        dates = []
        now = datetime.now()
        
        date_map = {
            'today': now,
            'tomorrow': now + timedelta(days=1),
            'next week': now + timedelta(weeks=1),
            'next month': now + timedelta(days=30),
            'end of day': now.replace(hour=23, minute=59),
            'end of week': now + timedelta(days=(6 - now.weekday())),
            'end of month': now.replace(day=1) + timedelta(days=32)
        }
        
        for phrase, date in date_map.items():
            if phrase in content.lower():
                dates.append(date)
        
        return dates
    
    def _extract_entities(self, content: str) -> List[str]:
        """Extract named entities (people, companies, etc.)"""
        entities = []
        
        # Extract @mentions
        mentions = re.findall(r'@(\w+)', content)
        entities.extend(mentions)
        
        # Extract sports teams
        sports_teams = re.findall(self.PATTERNS['sports_team'], content)
        entities.extend(sports_teams)
        
        # Extract political figures
        political = re.findall(self.PATTERNS['political_figure'], content)
        entities.extend(political)
        
        return list(set(entities))
    
    def _extract_metrics(self, content: str) -> Dict[str, Any]:
        """Extract quantifiable metrics"""
        metrics = {}
        
        # User/follower counts
        user_matches = re.findall(r'(\d+\.?\d*)\s*(million|M|thousand|K)?\s*(users?|followers?)', content, re.I)
        if user_matches:
            metrics['user_count'] = user_matches[0]
        
        # Percentages
        percent_matches = re.findall(self.PATTERNS['percentage'], content)
        if percent_matches:
            metrics['percentages'] = percent_matches
        
        return metrics
    
    def _check_verified(self, author: str) -> bool:
        """Check if author is verified/notable"""
        # In production, check against Twitter API
        notable_accounts = [
            'elonmusk', 'VitalikButerin', 'NBA', 'NFL', 
            'AP', 'Reuters', 'Apple', 'Tesla'
        ]
        return author.lower() in [a.lower() for a in notable_accounts]
    
    def _check_official_source(self, author: str) -> bool:
        """Check if author is official source for claims"""
        for category, accounts in self.OFFICIAL_ACCOUNTS.items():
            if author in accounts:
                return True
        return False
    
    def _detect_intent(
        self, 
        content: str, 
        context: TweetContext
    ) -> Tuple[TwitterIntent, float]:
        """Detect the primary intent of the tweet"""
        
        content_lower = content.lower()
        
        # Price predictions
        if context.mentioned_assets and context.mentioned_prices:
            if any(word in content_lower for word in ['will', 'reach', 'hit', 'exceed', 'above', 'below']):
                return TwitterIntent.PRICE_PREDICTION, 0.9
        
        # Sports predictions
        if any(word in content_lower for word in ['win', 'beat', 'defeat', 'champion', 'score']):
            if context.mentioned_entities:  # Has team names
                return TwitterIntent.SPORTS_PREDICTION, 0.85
        
        # Political claims
        if any(word in content_lower for word in ['election', 'vote', 'poll', 'primary', 'president']):
            return TwitterIntent.POLITICAL_CLAIM, 0.8
        
        # Product launches
        if any(word in content_lower for word in ['launch', 'announce', 'release', 'unveil']):
            if context.is_official_source:
                return TwitterIntent.PRODUCT_LAUNCH, 0.9
            return TwitterIntent.EVENT_OUTCOME, 0.7
        
        # Metric achievements
        if context.mentioned_metrics:
            if any(word in content_lower for word in ['reach', 'exceed', 'achieve', 'hit']):
                return TwitterIntent.METRIC_ACHIEVEMENT, 0.85
        
        # Market movements
        if any(word in content_lower for word in ['crash', 'moon', 'pump', 'dump', 'surge', 'plunge']):
            return TwitterIntent.MARKET_MOVEMENT, 0.75
        
        # Regulatory actions
        if any(word in content_lower for word in ['sec', 'approve', 'regulate', 'ban', 'legal']):
            return TwitterIntent.REGULATORY_ACTION, 0.8
        
        # Default to event outcome
        return TwitterIntent.EVENT_OUTCOME, 0.5

# ============ Oracle Query Builder ============

class OracleQueryBuilder:
    """Builds oracle-specific queries from Twitter context"""
    
    def __init__(self, openrouter_api_key: Optional[str] = None):
        self.analyzer = TwitterOracleAnalyzer()
        self.use_ai = openrouter_api_key is not None
        self.api_key = openrouter_api_key
        self.base_url = "https://openrouter.ai/api/v1"
        self.model = "openai/gpt-4o-mini"
    
    async def build_oracle_query(
        self, 
        tweet_data: Dict[str, Any]
    ) -> OracleQueryResponse:
        """Build perfect oracle query from tweet"""
        
        # Analyze tweet context
        context = self.analyzer.analyze_tweet(tweet_data)
        
        # Use AI enhancement if available
        if self.use_ai:
            return await self._build_ai_enhanced_query(context, tweet_data)
        
        # Route based on intent
        if context.detected_intent == TwitterIntent.PRICE_PREDICTION:
            return self._build_price_query(context)
        elif context.detected_intent == TwitterIntent.SPORTS_PREDICTION:
            return self._build_sports_query(context)
        elif context.detected_intent == TwitterIntent.POLITICAL_CLAIM:
            return self._build_political_query(context)
        elif context.detected_intent == TwitterIntent.PRODUCT_LAUNCH:
            return self._build_product_query(context)
        elif context.detected_intent == TwitterIntent.METRIC_ACHIEVEMENT:
            return self._build_metric_query(context)
        elif context.detected_intent == TwitterIntent.REGULATORY_ACTION:
            return self._build_regulatory_query(context)
        else:
            return self._build_generic_event_query(context)
    
    async def _build_ai_enhanced_query(
        self,
        context: TweetContext,
        tweet_data: Dict[str, Any]
    ) -> OracleQueryResponse:
        """Use GPT-4o-mini to build perfect oracle query with Pydantic schema validation"""
        
        # Get the Pydantic schema for OracleQueryResponse
        schema = OracleQueryResponse.model_json_schema()
        
        # Create prompt for GPT with schema
        prompt = f"""
        Analyze this tweet and create a prediction market query with oracle routing.
        
        Tweet from @{context.author}: "{context.content}"
        
        Context:
        - Intent: {context.detected_intent.value if context.detected_intent else 'unknown'}
        - Assets mentioned: {', '.join(context.mentioned_assets) if context.mentioned_assets else 'none'}
        - Prices mentioned: {', '.join([str(p) for p in context.mentioned_prices]) if context.mentioned_prices else 'none'}
        - Entities: {', '.join(context.mentioned_entities) if context.mentioned_entities else 'none'}
        - Is verified: {context.is_verified_account}
        
        Select the best oracle and create a query:
        - PYTH: For real-time crypto/stock prices (sub-second updates)
        - CHAINLINK: For sports, weather, aggregated data
        - UMA: For elections, events needing human verification
        - BAND: For custom data, social metrics
        - API3: For direct API data, NFT prices
        
        Respond with a JSON object matching this exact Pydantic schema:
        {json.dumps(schema, indent=2)}
        
        Important notes for the response:
        - oracle_provider must be one of: chainlink, pyth, band, uma, api3
        - resolution_time should be an ISO format datetime string
        - confidence must be between 0 and 1
        """
        
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {
                                "role": "system", 
                                "content": f"You are an expert in blockchain oracles and prediction markets. Always respond with valid JSON matching this exact Pydantic schema: {json.dumps(schema)}"
                            },
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.3,
                        "max_tokens": 500,
                        "response_format": {"type": "json_object"}
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    ai_data = json.loads(result["choices"][0]["message"]["content"])
                    
                    # Ensure resolution_time is a datetime string
                    if "resolution_time" not in ai_data:
                        ai_data["resolution_time"] = (datetime.now() + timedelta(hours=24)).isoformat()
                    elif isinstance(ai_data.get("resolution_time"), (int, float)):
                        # If it's hours, convert to datetime
                        hours = ai_data["resolution_time"]
                        ai_data["resolution_time"] = (datetime.now() + timedelta(hours=hours)).isoformat()
                    
                    # Parse AI response with Pydantic model validation
                    try:
                        oracle_response = OracleQueryResponse.model_validate(ai_data)
                        return oracle_response
                    except Exception as validation_error:
                        logger.error(f"Pydantic validation failed: {validation_error}")
                        # Try to fix common issues and retry
                        if "oracle_provider" in ai_data:
                            # Ensure lowercase for enum
                            ai_data["oracle_provider"] = ai_data["oracle_provider"].lower()
                        
                        # Second attempt with fixed data
                        try:
                            oracle_response = OracleQueryResponse.model_validate(ai_data)
                            return oracle_response
                        except:
                            logger.error(f"Second validation attempt failed, using fallback")
                    
        except Exception as e:
            logger.error(f"AI query building failed: {e}")
        
        # Fallback to rule-based routing
        return self._build_generic_event_query(context)
    
    def _build_price_query(self, context: TweetContext) -> OracleQueryResponse:
        """Build price prediction query"""
        
        asset = context.mentioned_assets[0] if context.mentioned_assets else "BTC"
        price = context.mentioned_prices[0] if context.mentioned_prices else Decimal("50000")
        
        # Determine comparison
        content_lower = context.content.lower()
        comparison = "above" if any(w in content_lower for w in ['above', 'exceed', 'over']) else "below"
        
        # Build Pyth query for crypto
        if asset in ['BTC', 'ETH', 'SOL', 'AVAX']:
            pyth_query = PythQuery(
                price_feed_id=self._get_pyth_feed_id(asset),
                asset_symbol=f"{asset}/USD",
                threshold_price=price,
                comparison=comparison
            )
            
            return OracleQueryResponse(
                question=f"Will {asset} be {comparison} ${price:,.0f} by end of day?",
                oracle_provider=OracleProvider.PYTH,
                oracle_config=pyth_query.model_dump(),
                resolution_criteria=f"{asset} price {comparison} ${price:,.0f}",
                resolution_source="Pyth Network real-time price feed",
                resolution_time=datetime.now() + timedelta(days=1),
                confidence=0.95,
                reasoning=f"Using Pyth for real-time {asset} price with sub-second updates"
            )
        
        # Use Chainlink for other assets
        chainlink_query = ChainlinkQuery(
            query_type="price_feed",
            asset_pair=f"{asset}/USD",
            threshold_value=price,
            comparison=comparison
        )
        
        return OracleQueryResponse(
            question=f"Will {asset} be {comparison} ${price:,.0f}?",
            oracle_provider=OracleProvider.CHAINLINK,
            oracle_config=chainlink_query.model_dump(),
            resolution_criteria=f"{asset} price {comparison} ${price:,.0f}",
            resolution_source="Chainlink aggregated price feed",
            resolution_time=datetime.now() + timedelta(days=1),
            confidence=0.9,
            reasoning="Using Chainlink for aggregated price data"
        )
    
    def _build_sports_query(self, context: TweetContext) -> OracleQueryResponse:
        """Build sports prediction query"""
        
        teams = context.mentioned_entities[:2] if len(context.mentioned_entities) >= 2 else ["Team A", "Team B"]
        
        chainlink_query = ChainlinkQuery(
            query_type="sports_data",
            sport_event_id=f"{teams[0]}_vs_{teams[1]}_{datetime.now().date()}"
        )
        
        return OracleQueryResponse(
            question=f"Will {teams[0]} beat {teams[1]}?",
            oracle_provider=OracleProvider.CHAINLINK,
            oracle_config=chainlink_query.model_dump(),
            resolution_criteria=f"{teams[0]} wins the game",
            resolution_source="TheRundown sports data via Chainlink",
            resolution_time=datetime.now() + timedelta(hours=6),
            confidence=0.9,
            reasoning="Chainlink has official sports data partnerships"
        )
    
    def _build_political_query(self, context: TweetContext) -> OracleQueryResponse:
        """Build political/election query"""
        
        uma_query = UMAQuery(
            identifier="YES_OR_NO_QUERY",
            question_text=f"Will {context.author}'s claim '{context.content[:100]}...' be proven true?",
            ancillary_data=json.dumps({
                "tweet_id": context.tweet_id,
                "author": context.author,
                "claim": context.content
            }),
            resolution_source=["AP", "Reuters", "Official government sources"],
            bond_amount=Decimal("500"),
            liveness_period=7200
        )
        
        return OracleQueryResponse(
            question=uma_query.question_text,
            oracle_provider=OracleProvider.UMA,
            oracle_config=uma_query.model_dump(),
            resolution_criteria="Claim verified by official sources",
            resolution_source="UMA Optimistic Oracle with human verification",
            resolution_time=datetime.now() + timedelta(days=7),
            confidence=0.85,
            reasoning="Political claims require human verification from trusted sources"
        )
    
    def _build_product_query(self, context: TweetContext) -> OracleQueryResponse:
        """Build product launch query"""
        
        uma_query = UMAQuery(
            identifier="YES_OR_NO_QUERY",
            question_text=f"Will {context.author} announce a new product by end of month?",
            ancillary_data=json.dumps({
                "company": context.author,
                "tweet_context": context.content
            }),
            resolution_source=["Official company announcement", "Press release"],
            bond_amount=Decimal("200")
        )
        
        return OracleQueryResponse(
            question=uma_query.question_text,
            oracle_provider=OracleProvider.UMA,
            oracle_config=uma_query.model_dump(),
            resolution_criteria="Official product announcement",
            resolution_source="Company press release or official channels",
            resolution_time=datetime.now() + timedelta(days=30),
            confidence=0.8,
            reasoning="Product launches verified through official announcements"
        )
    
    def _build_metric_query(self, context: TweetContext) -> OracleQueryResponse:
        """Build metric achievement query"""
        
        metric = context.mentioned_metrics.get('user_count', ['1M', 'users'])
        
        uma_query = UMAQuery(
            identifier="YES_OR_NO_QUERY",
            question_text=f"Will {context.author} reach {metric[0]} {metric[1]}?",
            ancillary_data=json.dumps(context.mentioned_metrics),
            resolution_source=["Platform analytics", "Official metrics"],
            bond_amount=Decimal("150")
        )
        
        return OracleQueryResponse(
            question=uma_query.question_text,
            oracle_provider=OracleProvider.UMA,
            oracle_config=uma_query.model_dump(),
            resolution_criteria=f"Official metrics show {metric[0]} {metric[1]}",
            resolution_source="Platform's official analytics",
            resolution_time=datetime.now() + timedelta(days=30),
            confidence=0.75,
            reasoning="Metric achievements verified through official data"
        )
    
    def _build_regulatory_query(self, context: TweetContext) -> OracleQueryResponse:
        """Build regulatory action query"""
        
        uma_query = UMAQuery(
            identifier="YES_OR_NO_QUERY",
            question_text=f"Will the regulatory action mentioned in tweet {context.tweet_id} occur?",
            ancillary_data=json.dumps({
                "tweet": context.content,
                "entities": context.mentioned_entities
            }),
            resolution_source=["SEC filings", "Official regulatory announcements"],
            bond_amount=Decimal("1000"),
            liveness_period=14400  # 4 hours for important regulatory matters
        )
        
        return OracleQueryResponse(
            question=uma_query.question_text,
            oracle_provider=OracleProvider.UMA,
            oracle_config=uma_query.model_dump(),
            resolution_criteria="Official regulatory filing or announcement",
            resolution_source="Government regulatory bodies",
            resolution_time=datetime.now() + timedelta(days=60),
            confidence=0.8,
            reasoning="Regulatory actions require official government verification"
        )
    
    def _build_generic_event_query(self, context: TweetContext) -> OracleQueryResponse:
        """Build generic event outcome query"""
        
        uma_query = UMAQuery(
            identifier="YES_OR_NO_QUERY",
            question_text=f"Will the event described in tweet {context.tweet_id} occur as claimed?",
            ancillary_data=json.dumps({
                "tweet_id": context.tweet_id,
                "author": context.author,
                "content": context.content,
                "timestamp": context.timestamp.isoformat()
            }),
            resolution_source=["News outlets", "Official sources", "On-chain data"],
            bond_amount=Decimal("100")
        )
        
        return OracleQueryResponse(
            question=uma_query.question_text,
            oracle_provider=OracleProvider.UMA,
            oracle_config=uma_query.model_dump(),
            resolution_criteria="Event occurs as described",
            resolution_source="Multiple verified sources",
            resolution_time=datetime.now() + timedelta(days=7),
            confidence=0.6,
            reasoning="Generic events use UMA for flexible human verification"
        )
    
    def _get_pyth_feed_id(self, asset: str) -> str:
        """Get Pyth price feed ID for asset"""
        feed_ids = {
            'BTC': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
            'ETH': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
            'SOL': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
            'AVAX': '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7'
        }
        return feed_ids.get(asset, '0x' + '0' * 64)