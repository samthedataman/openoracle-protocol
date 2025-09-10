"""
Twitter Agent for social media prediction markets
"""

import re
import hashlib
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

from .base_agent import BaseAgent


class TwitterAgent(BaseAgent):
    """Agent for analyzing tweets and creating prediction markets"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__("TwitterAgent", config)
        
        # Prediction patterns commonly found in tweets
        self.prediction_patterns = [
            r'(?i)(?:i (?:predict|think|believe)|(?:will|gonna) (?:hit|reach|exceed|be))',
            r'(?i)(?:by (?:end of|the end of)|\d{4})',
            r'(?i)(?:above|below|over|under) \$?[\d,]+',
            r'(?i)(?:will (?:win|lose|happen|announce))',
            r'(?i)(?:calling it now|mark my words|you heard it here)',
            r'(?i)(?:\$[A-Z]{1,5} (?:to|will hit) \$[\d,]+)'
        ]
        
        # High-influence accounts (example handles)
        self.influencer_handles = {
            'elonmusk': {'weight': 1.0, 'category': 'tech_ceo'},
            'naval': {'weight': 0.9, 'category': 'investor'},
            'chamath': {'weight': 0.8, 'category': 'investor'},
            'balajis': {'weight': 0.8, 'category': 'crypto'},
            'VitalikButerin': {'weight': 0.9, 'category': 'crypto'}
        }
    
    async def validate_input(self, data: Dict[str, Any]) -> bool:
        """Validate Twitter input data"""
        required_fields = ['tweet_text']
        return all(field in data for field in required_fields)
    
    async def process(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Process tweet data for prediction potential"""
        
        tweet_text = data['tweet_text']
        author = data.get('author', '').replace('@', '')
        tweet_url = data.get('tweet_url', '')
        
        # Analyze prediction potential
        prediction_analysis = self._analyze_prediction_potential(tweet_text)
        
        # Extract market parameters
        market_params = self._extract_market_parameters(tweet_text)
        
        # Calculate influence score
        influence_score = self._calculate_influence_score(author, tweet_text)
        
        # Generate market suggestion
        market_suggestion = self._generate_market_suggestion(
            tweet_text, author, market_params, prediction_analysis
        )
        
        return {
            'has_prediction': prediction_analysis['has_prediction'],
            'prediction_confidence': prediction_analysis['confidence'],
            'prediction_type': prediction_analysis['type'],
            'market_parameters': market_params,
            'influence_score': influence_score,
            'suggested_market': market_suggestion,
            'analysis': {
                'sentiment': self._analyze_sentiment(tweet_text),
                'complexity': self._calculate_complexity(tweet_text),
                'verifiability': self._assess_verifiability(tweet_text),
                'timeline': market_params.get('timeline', 'unknown')
            },
            'metadata': {
                'author': author,
                'tweet_url': tweet_url,
                'analyzed_at': datetime.now().isoformat()
            }
        }
    
    def _analyze_prediction_potential(self, tweet_text: str) -> Dict[str, Any]:
        """Analyze if tweet contains a prediction"""
        
        confidence = 0.0
        prediction_type = 'none'
        
        # Check for prediction patterns
        pattern_matches = 0
        for pattern in self.prediction_patterns:
            if re.search(pattern, tweet_text, re.IGNORECASE):
                pattern_matches += 1
        
        if pattern_matches > 0:
            confidence = min(pattern_matches / len(self.prediction_patterns) * 2, 1.0)
            
            # Determine prediction type
            tweet_lower = tweet_text.lower()
            
            if any(word in tweet_lower for word in ['price', '$', 'hit', 'reach', 'exceed']):
                prediction_type = 'price'
            elif any(word in tweet_lower for word in ['win', 'lose', 'champion', 'game']):
                prediction_type = 'sports'
            elif any(word in tweet_lower for word in ['election', 'vote', 'president']):
                prediction_type = 'politics'
            elif any(word in tweet_lower for word in ['announce', 'launch', 'release']):
                prediction_type = 'corporate'
            else:
                prediction_type = 'general'
        
        return {
            'has_prediction': confidence > 0.3,
            'confidence': confidence,
            'type': prediction_type,
            'pattern_matches': pattern_matches
        }
    
    def _extract_market_parameters(self, tweet_text: str) -> Dict[str, Any]:
        """Extract market parameters from tweet"""
        
        params = {}
        
        # Extract price targets
        price_pattern = r'\$?([\d,]+(?:\.\d+)?)\s*([kKmMbB]|thousand|million|billion)?'
        price_matches = re.findall(price_pattern, tweet_text)
        
        if price_matches:
            value, suffix = price_matches[0]
            # Convert to full number
            multipliers = {
                'k': 1000, 'K': 1000, 'thousand': 1000,
                'm': 1000000, 'M': 1000000, 'million': 1000000,
                'b': 1000000000, 'B': 1000000000, 'billion': 1000000000
            }
            
            multiplier = multipliers.get(suffix.lower(), 1)
            params['target_price'] = float(value.replace(',', '')) * multiplier
        
        # Extract assets
        crypto_pattern = r'\$?([A-Z]{2,6})(?=\s|$|[^A-Za-z])'
        crypto_matches = re.findall(crypto_pattern, tweet_text.upper())
        crypto_assets = [asset for asset in crypto_matches if asset in 
                        ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC', 'LINK', 'UNI', 'AAVE']]
        
        if crypto_assets:
            params['assets'] = crypto_assets
        
        # Extract timeline
        timeline = self._extract_timeline(tweet_text)
        if timeline:
            params['timeline'] = timeline
        
        # Extract comparison type
        if any(word in tweet_text.lower() for word in ['above', 'exceed', 'over', 'higher']):
            params['comparison'] = 'greater_than'
        elif any(word in tweet_text.lower() for word in ['below', 'under', 'less']):
            params['comparison'] = 'less_than'
        
        return params
    
    def _extract_timeline(self, tweet_text: str) -> Optional[str]:
        """Extract timeline from tweet"""
        
        # Year patterns
        year_pattern = r'(?:by |in |before )(\d{4})'
        year_match = re.search(year_pattern, tweet_text, re.IGNORECASE)
        if year_match:
            year = int(year_match.group(1))
            current_year = datetime.now().year
            if year >= current_year:
                return f"by_end_of_{year}"
        
        # Month patterns
        months = ['january', 'february', 'march', 'april', 'may', 'june',
                 'july', 'august', 'september', 'october', 'november', 'december']
        
        for month in months:
            if month in tweet_text.lower():
                return f"by_end_of_{month}"
        
        # Relative time patterns
        time_patterns = {
            r'(?:by |within )end of (?:the )?week': 'within_1_week',
            r'(?:by |within )end of (?:the )?month': 'within_1_month',
            r'(?:by |within )end of (?:the )?quarter': 'within_3_months',
            r'(?:by |within )end of (?:the )?year': 'within_1_year',
            r'(?:in the )?next (\d+) (?:days?|weeks?|months?)': 'relative_time'
        }
        
        for pattern, timeline in time_patterns.items():
            if re.search(pattern, tweet_text, re.IGNORECASE):
                return timeline
        
        return None
    
    def _calculate_influence_score(self, author: str, tweet_text: str) -> float:
        """Calculate influence score for the tweet"""
        
        base_score = 0.5
        
        # Author influence
        if author in self.influencer_handles:
            influence_data = self.influencer_handles[author]
            base_score += influence_data['weight'] * 0.4
        
        # Content quality indicators
        quality_indicators = [
            len(tweet_text) > 50,  # Substantial content
            '$' in tweet_text,     # Specific price targets
            any(word in tweet_text.lower() for word in ['analysis', 'because', 'due to']),  # Reasoning
            bool(re.search(r'\d{4}', tweet_text)),  # Specific timeline
        ]
        
        base_score += sum(quality_indicators) * 0.05
        
        # Confidence indicators
        confidence_words = ['confident', 'certain', 'definitely', 'guaranteed', 'calling it']
        if any(word in tweet_text.lower() for word in confidence_words):
            base_score += 0.1
        
        return min(base_score, 1.0)
    
    def _generate_market_suggestion(
        self, 
        tweet_text: str, 
        author: str, 
        params: Dict[str, Any], 
        analysis: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Generate market suggestion based on tweet analysis"""
        
        if not analysis['has_prediction']:
            return None
        
        # Generate question
        question = self._generate_question(tweet_text, params, analysis['type'])
        if not question:
            return None
        
        # Generate market ID
        market_id = self._generate_market_id(author, tweet_text)
        
        # Determine resolution criteria
        resolution = self._determine_resolution_criteria(analysis['type'], params)
        
        return {
            'question': question,
            'market_id': market_id,
            'type': analysis['type'],
            'resolution_criteria': resolution,
            'suggested_oracle': self._suggest_oracle(analysis['type'], params),
            'estimated_interest': self._estimate_interest(author, analysis, params),
            'timeline': params.get('timeline', 'open_ended'),
            'creator_context': {
                'author': author,
                'original_tweet': tweet_text[:280],  # Truncate to Twitter limit
                'influence_score': self._calculate_influence_score(author, tweet_text)
            }
        }
    
    def _generate_question(
        self, tweet_text: str, params: Dict[str, Any], prediction_type: str
    ) -> Optional[str]:
        """Generate a clear market question from tweet"""
        
        # Extract key elements
        assets = params.get('assets', [])
        target_price = params.get('target_price')
        timeline = params.get('timeline', '')
        comparison = params.get('comparison', 'greater_than')
        
        if prediction_type == 'price' and assets and target_price:
            asset = assets[0]
            operator = "exceed" if comparison == 'greater_than' else "fall below"
            
            # Format price nicely
            if target_price >= 1000000:
                price_str = f"${target_price/1000000:.1f}M"
            elif target_price >= 1000:
                price_str = f"${target_price/1000:.0f}K"
            else:
                price_str = f"${target_price:.0f}"
            
            timeline_str = ""
            if timeline:
                timeline_str = f" {timeline.replace('_', ' ')}"
            
            return f"Will {asset} {operator} {price_str}{timeline_str}?"
        
        # Fallback: extract prediction from tweet structure
        tweet_lower = tweet_text.lower()
        
        # Look for "will X happen" patterns
        will_pattern = r'(?:will|gonna)\s+([^?.!]+)'
        will_match = re.search(will_pattern, tweet_lower)
        
        if will_match:
            prediction_part = will_match.group(1).strip()
            # Clean up and capitalize
            question = f"Will {prediction_part}?"
            return question[:200]  # Limit length
        
        return None
    
    def _generate_market_id(self, author: str, tweet_text: str) -> str:
        """Generate unique market ID"""
        content_hash = hashlib.md5(f"{author}{tweet_text}".encode()).hexdigest()[:8]
        timestamp = datetime.now().strftime("%Y%m%d")
        return f"{author}_{timestamp}_{content_hash}"
    
    def _determine_resolution_criteria(
        self, prediction_type: str, params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Determine how the market should be resolved"""
        
        base_criteria = {
            'type': prediction_type,
            'verification_required': True
        }
        
        if prediction_type == 'price':
            assets = params.get('assets', [])
            if assets:
                base_criteria.update({
                    'data_source': 'price_oracle',
                    'assets': assets,
                    'target_price': params.get('target_price'),
                    'comparison': params.get('comparison', 'greater_than')
                })
        
        elif prediction_type == 'corporate':
            base_criteria.update({
                'data_source': 'official_announcement',
                'verification_sources': ['company_website', 'sec_filings', 'press_release']
            })
        
        elif prediction_type == 'sports':
            base_criteria.update({
                'data_source': 'official_sports_data',
                'verification_sources': ['league_official', 'espn', 'sports_apis']
            })
        
        elif prediction_type == 'politics':
            base_criteria.update({
                'data_source': 'election_results',
                'verification_sources': ['ap_news', 'reuters', 'official_results']
            })
        
        return base_criteria
    
    def _suggest_oracle(self, prediction_type: str, params: Dict[str, Any]) -> str:
        """Suggest best oracle for the prediction type"""
        
        oracle_mapping = {
            'price': 'pyth' if params.get('assets') else 'chainlink',
            'sports': 'chainlink',
            'politics': 'uma',
            'corporate': 'uma',
            'general': 'uma'
        }
        
        return oracle_mapping.get(prediction_type, 'chainlink')
    
    def _estimate_interest(
        self, author: str, analysis: Dict[str, Any], params: Dict[str, Any]
    ) -> str:
        """Estimate market interest level"""
        
        score = 0
        
        # Author influence
        if author in self.influencer_handles:
            score += self.influencer_handles[author]['weight'] * 30
        
        # Prediction confidence
        score += analysis['confidence'] * 20
        
        # Asset popularity (crypto gets more interest)
        assets = params.get('assets', [])
        popular_assets = ['BTC', 'ETH', 'SOL']
        if any(asset in popular_assets for asset in assets):
            score += 15
        
        # Clear timeline boosts interest
        if params.get('timeline'):
            score += 10
        
        if score >= 50:
            return 'high'
        elif score >= 25:
            return 'medium'
        else:
            return 'low'
    
    def _analyze_sentiment(self, tweet_text: str) -> str:
        """Simple sentiment analysis"""
        positive_words = ['bullish', 'moon', 'pump', 'up', 'high', 'win', 'success']
        negative_words = ['bearish', 'dump', 'crash', 'down', 'low', 'fail', 'lose']
        
        pos_count = sum(1 for word in positive_words if word in tweet_text.lower())
        neg_count = sum(1 for word in negative_words if word in tweet_text.lower())
        
        if pos_count > neg_count:
            return 'positive'
        elif neg_count > pos_count:
            return 'negative'
        else:
            return 'neutral'
    
    def _calculate_complexity(self, tweet_text: str) -> str:
        """Calculate prediction complexity"""
        
        complexity_score = 0
        
        # Multiple conditions
        if ' and ' in tweet_text.lower() or ' or ' in tweet_text.lower():
            complexity_score += 2
        
        # Specific numbers/dates
        if re.search(r'\d{4}|\$[\d,]+', tweet_text):
            complexity_score += 1
        
        # Multiple assets/subjects
        subjects = len(re.findall(r'[A-Z]{2,5}', tweet_text))
        complexity_score += min(subjects, 3)
        
        if complexity_score >= 4:
            return 'high'
        elif complexity_score >= 2:
            return 'medium'
        else:
            return 'low'
    
    def _assess_verifiability(self, tweet_text: str) -> str:
        """Assess how easily the prediction can be verified"""
        
        # High verifiability: prices, scores, official announcements
        high_verifiable = ['price', '$', 'announce', 'launch', 'score', 'win', 'lose']
        
        # Medium verifiability: subjective but measurable
        medium_verifiable = ['popular', 'successful', 'adoption', 'users']
        
        # Low verifiability: opinion-based
        low_verifiable = ['think', 'believe', 'opinion', 'feel']
        
        tweet_lower = tweet_text.lower()
        
        if any(word in tweet_lower for word in high_verifiable):
            return 'high'
        elif any(word in tweet_lower for word in medium_verifiable):
            return 'medium'
        elif any(word in tweet_lower for word in low_verifiable):
            return 'low'
        else:
            return 'medium'  # Default