"""
AI Oracle Routing Service
Intelligent routing of prediction market questions to appropriate oracle providers
"""

import re
import json
import logging
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field
import httpx

from .schemas.oracle_schemas import (
    OracleProvider,
    DataCategory,
    UpdateFrequency,
    OracleCapability,
    OracleRoutingRequest,
    OracleRoutingResponse,
    AIEnhancementRequest,
    AIEnhancementResponse,
    ChainlinkPriceFeed,
    PythPriceFeed,
    BandReferenceData,
    UMAOptimisticOracleRequest,
    API3dAPI
)

logger = logging.getLogger(__name__)

class AIQuestionAnalyzer:
    """Analyzes poll questions to determine oracle requirements"""
    
    # Keywords for categorizing questions - Enhanced for Polymarket-style bets
    CATEGORY_KEYWORDS = {
        DataCategory.PRICE: [
            'price', 'cost', 'value', 'worth', 'usd', 'dollar', 'euro', 'btc', 
            'eth', 'bitcoin', 'ethereum', 'crypto', 'stock', 'share', 'market cap',
            'above', 'below', 'exceed', 'reach', 'trade', 'close', 'open'
        ],
        DataCategory.SPORTS: [
            'game', 'match', 'score', 'win', 'lose', 'champion', 'playoff', 
            'tournament', 'team', 'player', 'goal', 'point', 'nfl', 'nba', 'mlb',
            'super bowl', 'world series', 'finals', 'mvp', 'draft', 'trade deadline',
            'season', 'touchdown', 'field goal', 'home run', 'strikeout', 'penalty',
            'overtime', 'spread', 'over/under', 'moneyline'
        ],
        DataCategory.WEATHER: [
            'weather', 'temperature', 'rain', 'snow', 'wind', 'hurricane', 
            'storm', 'celsius', 'fahrenheit', 'forecast', 'climate', 'drought',
            'flood', 'tornado', 'typhoon', 'heat wave', 'cold snap'
        ],
        DataCategory.ELECTION: [
            'election', 'vote', 'poll', 'candidate', 'president', 'senate', 
            'congress', 'governor', 'ballot', 'primary', 'electoral', 'democrat',
            'republican', 'independent', 'caucus', 'debate', 'campaign', 'incumbent',
            'swing state', 'electoral college', 'popular vote', 'midterm', 'runoff',
            'reelection', 'nomination', 'convention', 'polling', 'approval rating'
        ],
        DataCategory.ECONOMIC: [
            'gdp', 'inflation', 'cpi', 'unemployment', 'interest rate', 'fed', 
            'economy', 'recession', 'growth', 'jobs report', 'consumer', 'fomc',
            'powell', 'yellen', 'treasury', 'deficit', 'debt ceiling', 'shutdown',
            'stimulus', 'tapering', 'quantitative', 'hawk', 'dove', 'soft landing'
        ],
        DataCategory.STOCKS: [
            'stock', 'share', 'nasdaq', 'nyse', 's&p', 'dow', 'ticker', 
            'earnings', 'ipo', 'market close', 'trading', 'split', 'dividend',
            'buyback', 'merger', 'acquisition', 'bankruptcy', 'delisting'
        ],
        DataCategory.EVENTS: [
            'happen', 'occur', 'announce', 'release', 'launch', 'event', 
            'conference', 'meeting', 'decision', 'ruling', 'verdict', 'settlement',
            'indictment', 'arrest', 'resign', 'appoint', 'confirm', 'tweet', 'post',
            'ipo', 'product launch', 'keynote', 'award', 'oscar', 'grammy', 'emmy'
        ]
    }
    
    # Polymarket-style market patterns
    POLYMARKET_PATTERNS = {
        'binary_outcome': [
            r'will\s+(\w+)\s+win',
            r'will\s+(\w+)\s+be\s+elected',
            r'will\s+(\w+)\s+happen',
            r'will\s+there\s+be',
            r'will\s+(\w+)\s+exceed',
            r'will\s+(\w+)\s+reach'
        ],
        'date_based': [
            r'by\s+(january|february|march|april|may|june|july|august|september|october|november|december)',
            r'by\s+end\s+of\s+(day|week|month|quarter|year)',
            r'before\s+(\d{4})',
            r'within\s+(\d+)\s+(hours?|days?|weeks?|months?)'
        ],
        'threshold': [
            r'(above|below|over|under)\s+\$?([\d,]+)',
            r'more\s+than\s+([\d,]+)',
            r'less\s+than\s+([\d,]+)',
            r'at\s+least\s+([\d,]+)'
        ]
    }
    
    # Oracle capabilities matrix - Enhanced for Polymarket-style markets
    ORACLE_CAPABILITIES = {
        OracleProvider.CHAINLINK: {
            'categories': [DataCategory.PRICE, DataCategory.SPORTS, DataCategory.WEATHER, 
                          DataCategory.RANDOM, DataCategory.STOCKS, DataCategory.FOREX],
            'update_freq': UpdateFrequency.HIGH_FREQ,
            'chains': ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'bnb'],
            'latency_ms': 500,
            'reliability': 0.99,
            'special_feeds': {
                'sports': ['TheRundown', 'SportsdataIO', 'SportsMonks'],  # Chainlink sports data providers
                'weather': ['AccuWeather', 'OpenWeather', 'NOAA'],
                'stocks': ['Tiingo', 'AlphaVantage', 'Polygon.io']
            }
        },
        OracleProvider.PYTH: {
            'categories': [DataCategory.PRICE, DataCategory.STOCKS, DataCategory.FOREX, 
                          DataCategory.COMMODITIES],
            'update_freq': UpdateFrequency.REALTIME,
            'chains': ['solana', 'ethereum', 'arbitrum', 'optimism', 'base'],
            'latency_ms': 100,
            'reliability': 0.98,
            'special_feeds': {
                'stocks': ['NYSE', 'NASDAQ', 'indices'],
                'forex': ['major_pairs', 'minor_pairs'],
                'commodities': ['gold', 'silver', 'oil', 'natural_gas']
            }
        },
        OracleProvider.BAND: {
            'categories': [DataCategory.PRICE, DataCategory.STOCKS, DataCategory.FOREX,
                          DataCategory.COMMODITIES, DataCategory.CUSTOM],
            'update_freq': UpdateFrequency.MEDIUM_FREQ,
            'chains': ['cosmos', 'ethereum', 'binance', 'polygon'],
            'latency_ms': 1000,
            'reliability': 0.95,
            'special_feeds': {
                'custom': ['any_api_endpoint']  # Band can call any API
            }
        },
        OracleProvider.UMA: {
            'categories': [DataCategory.CUSTOM, DataCategory.EVENTS, DataCategory.ECONOMIC,
                          DataCategory.ELECTION],
            'update_freq': UpdateFrequency.ON_DEMAND,
            'chains': ['ethereum', 'polygon', 'arbitrum'],
            'latency_ms': 7200000,  # 2 hours for optimistic oracle
            'reliability': 0.97,
            'special_feeds': {
                'election': ['human_verified_results'],
                'events': ['news_outcomes', 'corporate_actions', 'regulatory_decisions'],
                'economic': ['fed_decisions', 'economic_reports']
            }
        },
        OracleProvider.API3: {
            'categories': [DataCategory.PRICE, DataCategory.WEATHER, DataCategory.SPORTS,
                          DataCategory.CUSTOM, DataCategory.NFT],
            'update_freq': UpdateFrequency.MEDIUM_FREQ,
            'chains': ['ethereum', 'polygon', 'avalanche', 'bnb', 'arbitrum'],
            'latency_ms': 800,
            'reliability': 0.96,
            'special_feeds': {
                'weather': ['direct_noaa', 'direct_accuweather'],
                'nft': ['opensea_floor', 'blur_floor']
            }
        }
    }
    
    # Polymarket-style resolution sources
    RESOLUTION_SOURCES = {
        'POLITICS': {
            'elections': ['AP', 'Reuters', 'official_gov_results'],
            'polls': ['FiveThirtyEight', 'RealClearPolitics', 'YouGov'],
            'approval': ['Gallup', 'Pew', 'Rasmussen']
        },
        'SPORTS': {
            'nfl': ['NFL.com', 'ESPN', 'TheAthletic'],
            'nba': ['NBA.com', 'ESPN', 'TheAthletic'],
            'mlb': ['MLB.com', 'ESPN', 'BaseballReference'],
            'soccer': ['FIFA', 'UEFA', 'PremierLeague.com']
        },
        'ECONOMIC': {
            'fed': ['federalreserve.gov', 'FOMC_statements'],
            'jobs': ['BLS.gov', 'ADP'],
            'inflation': ['BLS_CPI', 'PCE_index']
        },
        'CORPORATE': {
            'earnings': ['SEC_EDGAR', 'company_IR'],
            'products': ['official_announcements', 'press_releases']
        }
    }
    
    def analyze_question(self, question: str) -> Tuple[DataCategory, float]:
        """
        Analyze a question to determine data category
        Returns (category, confidence_score)
        """
        question_lower = question.lower()
        category_scores = {}
        
        # Score each category based on keyword matches
        for category, keywords in self.CATEGORY_KEYWORDS.items():
            score = sum(1 for keyword in keywords if keyword in question_lower)
            if score > 0:
                category_scores[category] = score
        
        if not category_scores:
            return DataCategory.CUSTOM, 0.3
        
        # Get the highest scoring category
        best_category = max(category_scores, key=category_scores.get)
        max_score = category_scores[best_category]
        
        # Calculate confidence (normalized)
        confidence = min(max_score / 5.0, 1.0)  # Cap at 1.0
        
        return best_category, confidence
    
    def extract_data_requirements(self, question: str) -> Dict[str, Any]:
        """Extract specific data requirements from the question"""
        requirements = {
            'assets': [],
            'timeframe': None,
            'comparison_type': None,
            'threshold': None,
            'original_question': question  # Store for context in oracle selection
        }
        
        # Extract cryptocurrency/stock symbols
        crypto_pattern = r'\b(BTC|ETH|SOL|AVAX|MATIC|BNB|USDC|USDT)\b'
        stock_pattern = r'\b([A-Z]{1,5})\b(?=\s+(?:stock|share|price))'
        
        crypto_matches = re.findall(crypto_pattern, question.upper())
        stock_matches = re.findall(stock_pattern, question)
        
        requirements['assets'] = list(set(crypto_matches + stock_matches))
        
        # Extract price thresholds
        price_pattern = r'\$?([\d,]+\.?\d*)\s*(?:k|K|thousand|million|M|B|billion)?'
        price_matches = re.findall(price_pattern, question)
        if price_matches:
            requirements['threshold'] = price_matches[0]
        
        # Extract timeframes
        time_keywords = {
            'today': timedelta(hours=24),
            'tomorrow': timedelta(hours=48),
            'week': timedelta(days=7),
            'month': timedelta(days=30),
            'year': timedelta(days=365),
            '24 hours': timedelta(hours=24),
            '48 hours': timedelta(hours=48)
        }
        
        for keyword, delta in time_keywords.items():
            if keyword in question.lower():
                requirements['timeframe'] = delta
                break
        
        # Detect comparison types
        if any(word in question.lower() for word in ['above', 'exceed', 'greater', 'higher']):
            requirements['comparison_type'] = 'greater_than'
        elif any(word in question.lower() for word in ['below', 'under', 'less', 'lower']):
            requirements['comparison_type'] = 'less_than'
        elif any(word in question.lower() for word in ['between', 'range']):
            requirements['comparison_type'] = 'range'
        
        return requirements

class OracleRoutingEngine:
    """Main routing engine for selecting appropriate oracles"""
    
    def __init__(self, openrouter_api_key: Optional[str] = None):
        self.analyzer = AIQuestionAnalyzer()
        self.openrouter_api_key = openrouter_api_key
        
    async def route_question(self, request: OracleRoutingRequest) -> OracleRoutingResponse:
        """
        Route a poll question to the most appropriate oracle
        """
        # Analyze the question
        category, confidence = self.analyzer.analyze_question(request.question)
        requirements = self.analyzer.extract_data_requirements(request.question)
        
        # Override category if hint provided
        if request.category_hint:
            category = request.category_hint
            confidence = 0.9
        
        # Find suitable oracles
        suitable_oracles = self._find_suitable_oracles(
            category=category,
            required_chains=request.required_chains,
            max_latency=request.max_latency_ms,
            max_cost=request.max_cost_usd,
            preferred_providers=request.preferred_providers
        )
        
        if not suitable_oracles:
            return OracleRoutingResponse(
                can_resolve=False,
                reasoning=f"No oracle found that supports {category.value} data on required chains",
                confidence_score=confidence
            )
        
        # Select the best oracle
        selected_oracle, reasoning = self._select_best_oracle(
            suitable_oracles, 
            category, 
            requirements
        )
        
        # Build oracle configuration
        oracle_config = self._build_oracle_config(
            selected_oracle,
            category,
            requirements
        )
        
        # Estimate costs and performance
        estimated_cost, estimated_latency = self._estimate_metrics(
            selected_oracle,
            category
        )
        
        return OracleRoutingResponse(
            can_resolve=True,
            selected_oracle=selected_oracle,
            reasoning=reasoning,
            oracle_config=oracle_config,
            alternatives=suitable_oracles[1:3] if len(suitable_oracles) > 1 else None,
            data_type=category,
            required_feeds=requirements.get('assets', []),
            estimated_cost_usd=estimated_cost,
            estimated_latency_ms=estimated_latency,
            confidence_score=confidence,
            resolution_method=self._determine_resolution_method(selected_oracle),
            update_frequency=self._get_update_frequency(selected_oracle)
        )
    
    def _find_suitable_oracles(
        self,
        category: DataCategory,
        required_chains: Optional[List[str]],
        max_latency: Optional[int],
        max_cost: Optional[Decimal],
        preferred_providers: Optional[List[OracleProvider]]
    ) -> List[OracleProvider]:
        """Find oracles that meet the requirements"""
        suitable = []
        
        for provider, capabilities in AIQuestionAnalyzer.ORACLE_CAPABILITIES.items():
            # Check if provider is preferred (if preferences exist)
            if preferred_providers and provider not in preferred_providers:
                continue
            
            # Check category support
            if category not in capabilities['categories']:
                continue
            
            # Check chain support
            if required_chains:
                supported_chains = set(capabilities['chains'])
                if not any(chain in supported_chains for chain in required_chains):
                    continue
            
            # Check latency requirements
            if max_latency and capabilities['latency_ms'] > max_latency:
                continue
            
            suitable.append(provider)
        
        # Sort by reliability
        suitable.sort(
            key=lambda p: AIQuestionAnalyzer.ORACLE_CAPABILITIES[p]['reliability'],
            reverse=True
        )
        
        return suitable
    
    def _select_best_oracle(
        self,
        suitable_oracles: List[OracleProvider],
        category: DataCategory,
        requirements: Dict[str, Any]
    ) -> Tuple[OracleProvider, str]:
        """Select the best oracle from suitable options - Polymarket-style routing"""
        
        if not suitable_oracles:
            return None, "No suitable oracles found"
        
        # === PRICE/CRYPTO MARKETS ===
        if category == DataCategory.PRICE and requirements.get('assets'):
            assets = requirements.get('assets', [])
            # For crypto prices with thresholds (e.g., "Will BTC exceed $100k?")
            if any(crypto in assets for crypto in ['BTC', 'ETH', 'SOL', 'AVAX']):
                if OracleProvider.PYTH in suitable_oracles:
                    return OracleProvider.PYTH, "Pyth Network selected for real-time crypto price feeds with sub-second updates"
            # For traditional assets
            if OracleProvider.CHAINLINK in suitable_oracles:
                return OracleProvider.CHAINLINK, "Chainlink selected for reliable aggregated price feeds"
        
        # === SPORTS BETTING ===
        if category == DataCategory.SPORTS:
            # Chainlink has partnerships with TheRundown, SportsdataIO
            if OracleProvider.CHAINLINK in suitable_oracles:
                return OracleProvider.CHAINLINK, "Chainlink selected - official sports data via TheRundown and SportsdataIO partnerships"
            # API3 as secondary for direct sports APIs
            if OracleProvider.API3 in suitable_oracles:
                return OracleProvider.API3, "API3 selected for direct sports API integration"
        
        # === POLITICAL/ELECTION MARKETS ===
        if category == DataCategory.ELECTION:
            # UMA's optimistic oracle is perfect for election results
            # Humans verify results from AP/Reuters
            if OracleProvider.UMA in suitable_oracles:
                return OracleProvider.UMA, "UMA Optimistic Oracle selected - human verification of election results from AP/Reuters"
            # Band as fallback for custom election data
            if OracleProvider.BAND in suitable_oracles:
                return OracleProvider.BAND, "Band Protocol selected for custom election data aggregation"
        
        # === ECONOMIC EVENTS (Fed decisions, jobs reports) ===
        if category == DataCategory.ECONOMIC:
            # UMA for Fed decisions and major economic events
            if OracleProvider.UMA in suitable_oracles:
                return OracleProvider.UMA, "UMA selected for Fed decisions and economic reports requiring human verification"
            # Chainlink for automated economic data
            if OracleProvider.CHAINLINK in suitable_oracles:
                return OracleProvider.CHAINLINK, "Chainlink selected for automated economic data feeds"
        
        # === WEATHER EVENTS ===
        if category == DataCategory.WEATHER:
            # API3 has direct NOAA integration
            if OracleProvider.API3 in suitable_oracles:
                return OracleProvider.API3, "API3 selected for direct NOAA weather data integration"
            # Chainlink AccuWeather integration
            if OracleProvider.CHAINLINK in suitable_oracles:
                return OracleProvider.CHAINLINK, "Chainlink selected for AccuWeather data feeds"
        
        # === CUSTOM EVENTS (Product launches, court decisions, etc.) ===
        if category in [DataCategory.CUSTOM, DataCategory.EVENTS]:
            # Check if it's a verifiable on-chain event
            question_lower = str(requirements.get('original_question', '')).lower()
            
            # Corporate events (earnings, product launches)
            if any(term in question_lower for term in ['announce', 'launch', 'release', 'ipo']):
                if OracleProvider.UMA in suitable_oracles:
                    return OracleProvider.UMA, "UMA selected for corporate announcement verification"
            
            # Legal/regulatory events
            if any(term in question_lower for term in ['court', 'ruling', 'verdict', 'approve', 'ban']):
                if OracleProvider.UMA in suitable_oracles:
                    return OracleProvider.UMA, "UMA selected for legal/regulatory outcome verification"
            
            # Social media events
            if any(term in question_lower for term in ['tweet', 'post', 'follow', 'ban', 'suspend']):
                if OracleProvider.BAND in suitable_oracles:
                    return OracleProvider.BAND, "Band Protocol selected for social media data verification"
        
        # === NFT MARKETS ===
        if category == DataCategory.NFT:
            if OracleProvider.API3 in suitable_oracles:
                return OracleProvider.API3, "API3 selected for NFT floor price data from OpenSea/Blur"
            if OracleProvider.CHAINLINK in suitable_oracles:
                return OracleProvider.CHAINLINK, "Chainlink selected for NFT price feeds"
        
        # Default to most reliable with explanation
        best = suitable_oracles[0]
        capabilities = AIQuestionAnalyzer.ORACLE_CAPABILITIES[best]
        reasoning = f"{best.value} selected (reliability: {capabilities['reliability']:.0%}) - best available option for {category.value} data"
        
        return best, reasoning
    
    def _build_oracle_config(
        self,
        provider: OracleProvider,
        category: DataCategory,
        requirements: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Build oracle-specific configuration"""
        
        config = {
            'provider': provider.value,
            'category': category.value,
            'requirements': requirements
        }
        
        if provider == OracleProvider.CHAINLINK:
            config['feed_type'] = 'price_feed' if category == DataCategory.PRICE else 'data_feed'
            if requirements.get('assets'):
                config['pairs'] = [f"{asset}/USD" for asset in requirements['assets']]
        
        elif provider == OracleProvider.PYTH:
            config['update_type'] = 'pull'
            if requirements.get('assets'):
                # Map assets to Pyth feed IDs (simplified)
                config['feed_ids'] = requirements['assets']
        
        elif provider == OracleProvider.UMA:
            config['oracle_type'] = 'optimistic'
            config['liveness_period'] = 7200  # 2 hours default
            config['bond_amount'] = "100"  # USDC
        
        return config
    
    def _estimate_metrics(
        self,
        provider: OracleProvider,
        category: DataCategory
    ) -> Tuple[Optional[Decimal], int]:
        """Estimate cost and latency for oracle usage"""
        
        capabilities = AIQuestionAnalyzer.ORACLE_CAPABILITIES[provider]
        latency = capabilities['latency_ms']
        
        # Simplified cost estimation (in USD)
        cost_map = {
            OracleProvider.CHAINLINK: Decimal("0.50"),
            OracleProvider.PYTH: Decimal("0.10"),
            OracleProvider.BAND: Decimal("0.30"),
            OracleProvider.UMA: Decimal("100.00"),  # Includes bond
            OracleProvider.API3: Decimal("0.25")
        }
        
        cost = cost_map.get(provider, Decimal("1.00"))
        
        return cost, latency
    
    def _determine_resolution_method(self, provider: OracleProvider) -> str:
        """Determine how the oracle resolves data"""
        
        if provider == OracleProvider.UMA:
            return "optimistic"
        elif provider in [OracleProvider.CHAINLINK, OracleProvider.PYTH]:
            return "direct"
        else:
            return "aggregated"
    
    def _get_update_frequency(self, provider: OracleProvider) -> UpdateFrequency:
        """Get the update frequency for the provider"""
        capabilities = AIQuestionAnalyzer.ORACLE_CAPABILITIES[provider]
        return capabilities['update_freq']

class EnhancedAIRoutingService:
    """Enhanced AI service with GPT-4o-mini via OpenRouter for complex routing decisions"""
    
    def __init__(self, openrouter_api_key: str):
        self.routing_engine = OracleRoutingEngine(openrouter_api_key)
        self.api_key = openrouter_api_key
        self.base_url = "https://openrouter.ai/api/v1"
        self.model = "openai/gpt-4o-mini"
        
    async def route_with_ai(self, request: OracleRoutingRequest) -> OracleRoutingResponse:
        """Use AI to enhance routing decisions for complex questions"""
        
        # First try basic routing
        basic_response = await self.routing_engine.route_question(request)
        
        # If confidence is low or question is complex, use AI
        if basic_response.confidence_score < 0.7:
            enhanced_response = await self._enhance_with_gpt(request, basic_response)
            return enhanced_response
        
        return basic_response
    
    async def _enhance_with_gpt(
        self,
        request: OracleRoutingRequest,
        basic_response: OracleRoutingResponse
    ) -> OracleRoutingResponse:
        """Enhance routing decision with GPT-4 using proper Pydantic schemas"""
        
        # Create AI enhancement request
        ai_request = AIEnhancementRequest(
            question=request.question,
            current_oracle=basic_response.selected_oracle,
            current_confidence=basic_response.confidence_score
        )
        
        # Get the Pydantic schema for AI Enhancement Response
        schema = AIEnhancementResponse.model_json_schema()
        
        prompt = f"""
        Analyze this prediction market question and determine the best oracle to resolve it:
        
        Question: {ai_request.question}
        
        Available oracles:
        - Chainlink: Price feeds, sports, weather, VRF
        - Pyth: Real-time price feeds, stocks, forex
        - Band: Cross-chain data, custom requests
        - UMA: Optimistic oracle for custom events
        - API3: First-party oracle data, weather, custom APIs
        
        Current analysis suggests: {ai_request.current_oracle or 'No suitable oracle'}
        Confidence: {ai_request.current_confidence}
        
        Respond with a JSON object matching this exact schema:
        {json.dumps(schema, indent=2)}
        """
        
        try:
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
                                "content": f"You are an expert in blockchain oracles. Always respond with valid JSON matching this exact Pydantic schema: {json.dumps(schema)}"
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
                    
                    # Parse AI response with Pydantic model validation
                    try:
                        ai_enhancement = AIEnhancementResponse.model_validate(ai_data)
                        
                        # Create new response with enhanced data
                        return OracleRoutingResponse(
                            can_resolve=True,
                            selected_oracle=ai_enhancement.oracle,
                            reasoning=ai_enhancement.reasoning,
                            oracle_config=basic_response.oracle_config,
                            alternatives=basic_response.alternatives,
                            data_type=ai_enhancement.data_type,
                            required_feeds=ai_enhancement.feeds,
                            estimated_cost_usd=basic_response.estimated_cost_usd,
                            estimated_latency_ms=basic_response.estimated_latency_ms,
                            confidence_score=min(
                                basic_response.confidence_score + ai_enhancement.confidence_boost, 
                                1.0
                            ),
                            resolution_method=basic_response.resolution_method,
                            update_frequency=basic_response.update_frequency
                        )
                    except Exception as parse_error:
                        logger.error(f"Failed to validate AI response with Pydantic: {parse_error}")
                        return basic_response
                        
        except Exception as e:
            logger.error(f"GPT enhancement failed: {e}")
        
        # Return original response if enhancement fails
        return basic_response