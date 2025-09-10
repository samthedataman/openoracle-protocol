"""
Advanced Question Analysis for Oracle Routing
"""

import re
from typing import Dict, List, Tuple, Any, Optional
from datetime import datetime, timedelta
from decimal import Decimal

from ..schemas.oracle_schemas import DataCategory, OracleProvider


class QuestionAnalyzer:
    """Advanced analysis of prediction market questions"""
    
    # Enhanced category keywords for Polymarket-style questions
    CATEGORY_KEYWORDS = {
        DataCategory.PRICE: [
            'price', 'cost', 'value', 'worth', 'usd', 'dollar', 'euro', 'btc', 
            'eth', 'bitcoin', 'ethereum', 'crypto', 'stock', 'share', 'market cap',
            'above', 'below', 'exceed', 'reach', 'trade', 'close', 'open', 'hit'
        ],
        DataCategory.SPORTS: [
            'game', 'match', 'score', 'win', 'lose', 'champion', 'playoff', 
            'tournament', 'team', 'player', 'goal', 'point', 'nfl', 'nba', 'mlb',
            'super bowl', 'world series', 'finals', 'mvp', 'draft', 'trade deadline',
            'season', 'touchdown', 'field goal', 'home run', 'strikeout', 'penalty'
        ],
        DataCategory.WEATHER: [
            'weather', 'temperature', 'rain', 'snow', 'wind', 'hurricane', 
            'storm', 'celsius', 'fahrenheit', 'forecast', 'climate', 'drought'
        ],
        DataCategory.ELECTION: [
            'election', 'vote', 'poll', 'candidate', 'president', 'senate', 
            'congress', 'governor', 'ballot', 'primary', 'electoral', 'democrat',
            'republican', 'independent', 'caucus', 'debate', 'campaign'
        ],
        DataCategory.ECONOMIC: [
            'gdp', 'inflation', 'cpi', 'unemployment', 'interest rate', 'fed', 
            'economy', 'recession', 'growth', 'jobs report', 'consumer', 'fomc'
        ]
    }
    
    # Market pattern recognition
    MARKET_PATTERNS = {
        'binary_outcome': [
            r'will\s+(\w+)\s+win',
            r'will\s+(\w+)\s+be\s+elected',
            r'will\s+(\w+)\s+happen',
            r'will\s+there\s+be',
            r'will\s+(\w+)\s+exceed',
            r'will\s+(\w+)\s+reach'
        ],
        'price_threshold': [
            r'(above|below|over|under)\s+\$?([\d,]+)',
            r'exceed\s+\$?([\d,]+)',
            r'hit\s+\$?([\d,]+)'
        ],
        'date_based': [
            r'by\s+(january|february|march|april|may|june|july|august|september|october|november|december)',
            r'by\s+end\s+of\s+(day|week|month|quarter|year)',
            r'before\s+(\d{4})',
            r'within\s+(\d+)\s+(hours?|days?|weeks?|months?)'
        ]
    }
    
    def analyze_question(self, question: str) -> Tuple[DataCategory, float]:
        """
        Analyze question to determine category and confidence
        Returns (category, confidence_score)
        """
        question_lower = question.lower()
        category_scores = {}
        
        # Score categories based on keyword matches
        for category, keywords in self.CATEGORY_KEYWORDS.items():
            score = 0
            for keyword in keywords:
                if keyword in question_lower:
                    # Weight longer keywords more heavily
                    weight = len(keyword.split()) * 2 if len(keyword.split()) > 1 else 1
                    score += weight
            
            if score > 0:
                category_scores[category] = score
        
        # Pattern-based boosting
        for pattern_type, patterns in self.MARKET_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, question_lower, re.IGNORECASE):
                    if pattern_type == 'price_threshold':
                        category_scores[DataCategory.PRICE] = category_scores.get(DataCategory.PRICE, 0) + 5
                    elif pattern_type == 'binary_outcome':
                        # Boost the highest category
                        if category_scores:
                            max_category = max(category_scores, key=category_scores.get)
                            category_scores[max_category] += 3
        
        if not category_scores:
            return DataCategory.CUSTOM, 0.3
        
        # Select best category
        best_category = max(category_scores, key=category_scores.get)
        max_score = category_scores[best_category]
        
        # Calculate confidence (normalized to 0-1)
        confidence = min(max_score / 10.0, 1.0)
        
        return best_category, confidence
    
    def extract_data_requirements(self, question: str) -> Dict[str, Any]:
        """Extract specific data requirements from question"""
        requirements = {
            'assets': [],
            'timeframe': None,
            'comparison_type': None,
            'threshold': None,
            'market_type': self._determine_market_type(question),
            'original_question': question
        }
        
        # Extract assets (crypto, stocks, etc.)
        requirements['assets'] = self._extract_assets(question)
        
        # Extract price thresholds
        requirements['threshold'] = self._extract_threshold(question)
        
        # Extract timeframes
        requirements['timeframe'] = self._extract_timeframe(question)
        
        # Determine comparison type
        requirements['comparison_type'] = self._extract_comparison_type(question)
        
        return requirements
    
    def _extract_assets(self, question: str) -> List[str]:
        """Extract asset symbols from question"""
        assets = []
        
        # Crypto patterns
        crypto_pattern = r'\b(BTC|ETH|SOL|AVAX|MATIC|BNB|USDC|USDT|ADA|DOT|LINK|UNI)\b'
        crypto_matches = re.findall(crypto_pattern, question.upper())
        assets.extend(crypto_matches)
        
        # Stock patterns (company names and tickers)
        stock_companies = {
            'tesla': 'TSLA', 'apple': 'AAPL', 'microsoft': 'MSFT', 'google': 'GOOGL',
            'amazon': 'AMZN', 'netflix': 'NFLX', 'meta': 'META', 'nvidia': 'NVDA'
        }
        
        for company, ticker in stock_companies.items():
            if company in question.lower():
                assets.append(ticker)
        
        # Direct ticker pattern
        ticker_pattern = r'\b([A-Z]{1,5})\b(?=\s+(?:stock|share|price))'
        ticker_matches = re.findall(ticker_pattern, question)
        assets.extend(ticker_matches)
        
        return list(set(assets))
    
    def _extract_threshold(self, question: str) -> Optional[str]:
        """Extract price/numeric thresholds"""
        # Enhanced price pattern with K, M, B suffixes
        price_pattern = r'\$?([\d,]+\.?\d*)\s*([kKmMbB]|thousand|million|billion)?'
        matches = re.findall(price_pattern, question)
        
        if matches:
            value, suffix = matches[0]
            # Convert suffix to full number
            multipliers = {
                'k': '000', 'K': '000', 'thousand': '000',
                'm': '000000', 'M': '000000', 'million': '000000',
                'b': '000000000', 'B': '000000000', 'billion': '000000000'
            }
            
            if suffix.lower() in ['k', 'thousand']:
                return f"{value}000"
            elif suffix.lower() in ['m', 'million']:
                return f"{value}000000"
            elif suffix.lower() in ['b', 'billion']:
                return f"{value}000000000"
            else:
                return value
        
        return None
    
    def _extract_timeframe(self, question: str) -> Optional[timedelta]:
        """Extract timeframe from question"""
        time_patterns = {
            r'by\s+end\s+of\s+(?:the\s+)?day': timedelta(days=1),
            r'by\s+end\s+of\s+(?:the\s+)?week': timedelta(days=7),
            r'by\s+end\s+of\s+(?:the\s+)?month': timedelta(days=30),
            r'by\s+end\s+of\s+(?:the\s+)?year': timedelta(days=365),
            r'within\s+(\d+)\s+hours?': lambda m: timedelta(hours=int(m.group(1))),
            r'within\s+(\d+)\s+days?': lambda m: timedelta(days=int(m.group(1))),
            r'within\s+(\d+)\s+weeks?': lambda m: timedelta(weeks=int(m.group(1))),
            r'within\s+(\d+)\s+months?': lambda m: timedelta(days=int(m.group(1)) * 30)
        }
        
        for pattern, delta in time_patterns.items():
            match = re.search(pattern, question.lower())
            if match:
                if callable(delta):
                    return delta(match)
                else:
                    return delta
        
        # Date-specific patterns
        year_pattern = r'(?:by\s+|before\s+)(\d{4})'
        year_match = re.search(year_pattern, question)
        if year_match:
            target_year = int(year_match.group(1))
            current_year = datetime.now().year
            return timedelta(days=(target_year - current_year) * 365)
        
        return None
    
    def _extract_comparison_type(self, question: str) -> Optional[str]:
        """Determine comparison type from question"""
        question_lower = question.lower()
        
        if any(word in question_lower for word in ['above', 'exceed', 'greater', 'higher', 'over', 'hit']):
            return 'greater_than'
        elif any(word in question_lower for word in ['below', 'under', 'less', 'lower']):
            return 'less_than'
        elif any(word in question_lower for word in ['between', 'range']):
            return 'range'
        elif any(word in question_lower for word in ['equal', 'exactly']):
            return 'equal'
        
        return None
    
    def _determine_market_type(self, question: str) -> str:
        """Determine the type of prediction market"""
        question_lower = question.lower()
        
        # Binary yes/no markets
        if any(pattern in question_lower for pattern in ['will ', 'can ', 'does ', 'is ']):
            return 'binary'
        
        # Categorical markets
        if any(word in question_lower for word in ['who will', 'which ', 'what will']):
            return 'categorical'
        
        # Scalar/range markets
        if any(word in question_lower for word in ['how many', 'how much', 'what price']):
            return 'scalar'
        
        return 'binary'  # Default
    
    def get_complexity_score(self, question: str) -> float:
        """Calculate question complexity for routing decisions"""
        complexity = 0.0
        
        # Length complexity
        word_count = len(question.split())
        complexity += min(word_count / 50.0, 0.3)
        
        # Multiple conditions
        if ' and ' in question.lower() or ' or ' in question.lower():
            complexity += 0.2
        
        # Timeframe complexity
        if self._extract_timeframe(question):
            complexity += 0.1
        
        # Numeric thresholds
        if self._extract_threshold(question):
            complexity += 0.1
        
        # Multiple assets
        assets = self._extract_assets(question)
        if len(assets) > 1:
            complexity += 0.2
        
        return min(complexity, 1.0)