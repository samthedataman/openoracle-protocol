"""
Market Agent for prediction market analysis and optimization
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from decimal import Decimal

from .base_agent import BaseAgent
from ..schemas.oracle_schemas import DataCategory, OracleProvider


class MarketAgent(BaseAgent):
    """Agent for analyzing and optimizing prediction markets"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__("MarketAgent", config)
        
        # Market category classifications
        self.market_categories = {
            'crypto': ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC', 'LINK', 'UNI'],
            'stocks': ['AAPL', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA'],
            'sports': ['NFL', 'NBA', 'MLB', 'Premier League', 'Champions League'],
            'politics': ['election', 'president', 'congress', 'senate', 'vote'],
            'economics': ['Fed', 'interest rate', 'inflation', 'GDP', 'unemployment']
        }
        
        # Oracle recommendations by category
        self.oracle_recommendations = {
            'crypto_price': {
                'primary': OracleProvider.PYTH,
                'secondary': OracleProvider.CHAINLINK,
                'reasoning': 'Real-time crypto price feeds with sub-second updates'
            },
            'stock_price': {
                'primary': OracleProvider.CHAINLINK,
                'secondary': OracleProvider.PYTH,
                'reasoning': 'Reliable stock price aggregation from multiple sources'
            },
            'sports_outcome': {
                'primary': OracleProvider.CHAINLINK,
                'secondary': OracleProvider.API3,
                'reasoning': 'Official sports data via TheRundown partnership'
            },
            'election_results': {
                'primary': OracleProvider.UMA,
                'secondary': OracleProvider.BAND,
                'reasoning': 'Human verification for election result accuracy'
            },
            'economic_data': {
                'primary': OracleProvider.CHAINLINK,
                'secondary': OracleProvider.UMA,
                'reasoning': 'Fed decisions require human verification for complex outcomes'
            },
            'weather_events': {
                'primary': OracleProvider.API3,
                'secondary': OracleProvider.CHAINLINK,
                'reasoning': 'Direct NOAA integration for weather data'
            },
            'custom_events': {
                'primary': OracleProvider.UMA,
                'secondary': OracleProvider.BAND,
                'reasoning': 'Optimistic oracle with dispute mechanism for complex events'
            }
        }
    
    async def validate_input(self, data: Dict[str, Any]) -> bool:
        """Validate market analysis input data"""
        return 'question' in data or 'market_data' in data
    
    async def process(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Process market data for analysis and optimization"""
        
        if 'question' in data:
            return await self._analyze_market_question(data)
        elif 'market_data' in data:
            return await self._analyze_existing_market(data)
        else:
            return {'error': 'No valid input data provided'}
    
    async def _analyze_market_question(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze a market question for optimization"""
        
        question = data['question']
        context = data.get('context', {})
        
        # Categorize the market
        category = self._categorize_market(question)
        
        # Analyze question structure
        structure_analysis = self._analyze_question_structure(question)
        
        # Get oracle recommendations
        oracle_rec = self._get_oracle_recommendation(category, question)
        
        # Estimate market parameters
        market_params = self._estimate_market_parameters(question, category)
        
        # Calculate viability score
        viability = self._calculate_market_viability(
            question, category, structure_analysis, context
        )
        
        return {
            'category': category,
            'structure_analysis': structure_analysis,
            'oracle_recommendation': oracle_rec,
            'market_parameters': market_params,
            'viability_score': viability['score'],
            'viability_factors': viability['factors'],
            'optimization_suggestions': self._generate_optimization_suggestions(
                question, category, structure_analysis
            ),
            'risk_assessment': self._assess_market_risks(question, category),
            'estimated_metrics': {
                'expected_volume': self._estimate_volume(category, context),
                'resolution_difficulty': structure_analysis['resolution_difficulty'],
                'dispute_probability': self._estimate_dispute_probability(category, question)
            }
        }
    
    async def _analyze_existing_market(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze an existing market for optimization"""
        
        market_data = data['market_data']
        
        # Extract market metrics
        metrics = self._extract_market_metrics(market_data)
        
        # Analyze performance
        performance = self._analyze_market_performance(market_data)
        
        # Generate improvement suggestions
        improvements = self._suggest_market_improvements(market_data, performance)
        
        return {
            'metrics': metrics,
            'performance': performance,
            'improvements': improvements,
            'health_score': self._calculate_market_health_score(market_data),
            'oracle_performance': self._analyze_oracle_performance(market_data)
        }
    
    def _categorize_market(self, question: str) -> str:
        """Categorize the market based on question content"""
        
        question_lower = question.lower()
        
        # Check for crypto assets
        for asset in self.market_categories['crypto']:
            if asset.lower() in question_lower:
                if any(word in question_lower for word in ['price', '$', 'hit', 'reach']):
                    return 'crypto_price'
                return 'crypto_general'
        
        # Check for stock assets
        for asset in self.market_categories['stocks']:
            if asset.lower() in question_lower:
                return 'stock_price'
        
        # Check for sports
        if any(term in question_lower for term in ['win', 'game', 'match', 'championship', 'mvp']):
            return 'sports_outcome'
        
        # Check for politics
        if any(term in question_lower for term in self.market_categories['politics']):
            return 'election_results'
        
        # Check for economics
        if any(term in question_lower for term in self.market_categories['economics']):
            return 'economic_data'
        
        # Check for weather
        if any(term in question_lower for term in ['weather', 'hurricane', 'temperature', 'storm']):
            return 'weather_events'
        
        return 'custom_events'
    
    def _analyze_question_structure(self, question: str) -> Dict[str, Any]:
        """Analyze the structure and clarity of a market question"""
        
        analysis = {
            'clarity_score': 0.0,
            'specificity_score': 0.0,
            'resolution_difficulty': 'medium',
            'ambiguity_issues': [],
            'improvements_needed': []
        }
        
        question_lower = question.lower()
        
        # Clarity factors
        clarity_factors = [
            ('has_clear_outcome', any(word in question_lower for word in ['will', 'does', 'is'])),
            ('has_timeframe', any(word in question_lower for word in ['by', 'before', '2024', '2025'])),
            ('has_specific_metric', '$' in question or any(char.isdigit() for char in question)),
            ('binary_structure', question.count('?') == 1),
            ('reasonable_length', 10 <= len(question.split()) <= 25)
        ]
        
        clarity_score = sum(1 for _, condition in clarity_factors if condition) / len(clarity_factors)
        analysis['clarity_score'] = clarity_score
        
        # Specificity analysis
        specificity_factors = []
        
        # Specific numbers/prices
        if '$' in question or any(char.isdigit() for char in question):
            specificity_factors.append('specific_numbers')
        
        # Specific dates/timeframes
        if any(word in question_lower for word in ['2024', '2025', 'january', 'march', 'december']):
            specificity_factors.append('specific_timeframe')
        
        # Specific assets/entities
        import re
        if re.search(r'[A-Z]{2,5}', question):  # Likely tickers or acronyms
            specificity_factors.append('specific_assets')
        
        analysis['specificity_score'] = len(specificity_factors) / 3  # Normalize to 0-1
        
        # Resolution difficulty
        if any(word in question_lower for word in ['opinion', 'think', 'believe', 'subjective']):
            analysis['resolution_difficulty'] = 'high'
            analysis['ambiguity_issues'].append('Subjective language detected')
        
        elif any(word in question_lower for word in ['price', 'score', 'number', 'count']):
            analysis['resolution_difficulty'] = 'low'
        
        # Ambiguity detection
        ambiguous_phrases = ['successful', 'popular', 'significant', 'major', 'large']
        for phrase in ambiguous_phrases:
            if phrase in question_lower:
                analysis['ambiguity_issues'].append(f"Ambiguous term: '{phrase}'")
        
        # Improvement suggestions
        if clarity_score < 0.6:
            analysis['improvements_needed'].append('Clarify the outcome criteria')
        
        if 'specific_timeframe' not in specificity_factors:
            analysis['improvements_needed'].append('Add specific deadline/timeframe')
        
        if analysis['ambiguity_issues']:
            analysis['improvements_needed'].append('Replace ambiguous terms with specific metrics')
        
        return analysis
    
    def _get_oracle_recommendation(self, category: str, question: str) -> Dict[str, Any]:
        """Get oracle recommendation for the market category"""
        
        base_rec = self.oracle_recommendations.get(category, 
            self.oracle_recommendations['custom_events'])
        
        # Adjust recommendation based on question specifics
        question_lower = question.lower()
        
        # For crypto questions, prefer Pyth for real-time needs
        if 'crypto' in category and any(word in question_lower for word in ['real-time', 'live', 'instant']):
            base_rec = {
                'primary': OracleProvider.PYTH,
                'secondary': OracleProvider.CHAINLINK,
                'reasoning': 'Real-time crypto data requires sub-second updates from Pyth'
            }
        
        # For complex/subjective questions, prefer UMA
        if any(word in question_lower for word in ['complex', 'subjective', 'opinion', 'interpretation']):
            base_rec = {
                'primary': OracleProvider.UMA,
                'secondary': OracleProvider.BAND,
                'reasoning': 'Complex questions require human verification via UMA optimistic oracle'
            }
        
        return base_rec
    
    def _estimate_market_parameters(self, question: str, category: str) -> Dict[str, Any]:
        """Estimate optimal market parameters"""
        
        params = {
            'suggested_fee': '0.02',  # 2% base fee
            'liquidity_requirement': 'medium',
            'resolution_timeline': self._estimate_resolution_timeline(question),
            'dispute_period': self._estimate_dispute_period(category),
            'minimum_stake': self._estimate_minimum_stake(category)
        }
        
        # Adjust parameters based on category
        if category == 'crypto_price':
            params.update({
                'suggested_fee': '0.015',  # Lower fee for high-volume crypto markets
                'liquidity_requirement': 'high',
                'resolution_timeline': 'immediate'  # Price-based resolution
            })
        
        elif category == 'election_results':
            params.update({
                'suggested_fee': '0.03',  # Higher fee for complex verification
                'dispute_period': '72_hours',  # Longer dispute period
                'minimum_stake': '100'  # Higher stake for important events
            })
        
        elif category == 'sports_outcome':
            params.update({
                'resolution_timeline': '2_hours_after_event',
                'dispute_period': '24_hours'
            })
        
        return params
    
    def _calculate_market_viability(
        self, question: str, category: str, structure: Dict[str, Any], context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Calculate overall market viability score"""
        
        factors = {}
        total_score = 0
        
        # Question quality (30% weight)
        question_score = (structure['clarity_score'] + structure['specificity_score']) / 2
        factors['question_quality'] = question_score
        total_score += question_score * 0.3
        
        # Resolution feasibility (25% weight)
        resolution_score = {'low': 1.0, 'medium': 0.7, 'high': 0.4}[structure['resolution_difficulty']]
        factors['resolution_feasibility'] = resolution_score
        total_score += resolution_score * 0.25
        
        # Market interest (20% weight)
        interest_score = self._estimate_market_interest(question, category, context)
        factors['market_interest'] = interest_score
        total_score += interest_score * 0.2
        
        # Oracle availability (15% weight)
        oracle_score = self._assess_oracle_availability(category)
        factors['oracle_availability'] = oracle_score
        total_score += oracle_score * 0.15
        
        # Risk level (10% weight - inverted)
        risk_score = 1.0 - self._assess_risk_level(question, category)
        factors['low_risk'] = risk_score
        total_score += risk_score * 0.1
        
        return {
            'score': total_score,
            'factors': factors,
            'recommendation': self._get_viability_recommendation(total_score)
        }
    
    def _estimate_market_interest(self, question: str, category: str, context: Dict[str, Any]) -> float:
        """Estimate market interest level"""
        
        base_interest = {
            'crypto_price': 0.8,
            'stock_price': 0.7,
            'sports_outcome': 0.9,
            'election_results': 0.85,
            'economic_data': 0.6,
            'weather_events': 0.4,
            'custom_events': 0.5
        }.get(category, 0.5)
        
        # Boost for popular assets
        question_lower = question.lower()
        popular_assets = ['btc', 'eth', 'bitcoin', 'ethereum', 'tesla', 'apple']
        if any(asset in question_lower for asset in popular_assets):
            base_interest += 0.15
        
        # Boost for current events
        creator_influence = context.get('creator_influence', 0.5)
        base_interest += creator_influence * 0.1
        
        return min(base_interest, 1.0)
    
    def _assess_oracle_availability(self, category: str) -> float:
        """Assess oracle availability and reliability for category"""
        
        availability_scores = {
            'crypto_price': 1.0,     # Excellent oracle support
            'stock_price': 0.9,      # Good oracle support
            'sports_outcome': 0.8,   # Good sports data availability
            'election_results': 0.7, # Requires human verification
            'economic_data': 0.8,    # Fed data available
            'weather_events': 0.75,  # Weather APIs available
            'custom_events': 0.6     # Requires custom verification
        }
        
        return availability_scores.get(category, 0.5)
    
    def _assess_risk_level(self, question: str, category: str) -> float:
        """Assess risk level of the market (0 = low risk, 1 = high risk)"""
        
        base_risk = {
            'crypto_price': 0.3,      # Objective price data
            'stock_price': 0.2,       # Very objective
            'sports_outcome': 0.25,   # Clear outcomes
            'election_results': 0.4,  # Potential disputes
            'economic_data': 0.3,     # Official data sources
            'weather_events': 0.35,   # Measurement interpretation
            'custom_events': 0.6      # High subjectivity risk
        }.get(category, 0.5)
        
        # Increase risk for ambiguous language
        question_lower = question.lower()
        ambiguous_terms = ['significant', 'major', 'successful', 'popular', 'large']
        risk_boost = sum(0.05 for term in ambiguous_terms if term in question_lower)
        
        return min(base_risk + risk_boost, 1.0)
    
    def _get_viability_recommendation(self, score: float) -> str:
        """Get recommendation based on viability score"""
        
        if score >= 0.8:
            return "Highly recommended - excellent market potential"
        elif score >= 0.65:
            return "Recommended - good market potential with minor improvements needed"
        elif score >= 0.5:
            return "Conditional - requires improvements before launch"
        else:
            return "Not recommended - significant issues need resolution"
    
    def _generate_optimization_suggestions(
        self, question: str, category: str, structure: Dict[str, Any]
    ) -> List[str]:
        """Generate specific optimization suggestions"""
        
        suggestions = []
        
        # Structure improvements
        if structure['clarity_score'] < 0.7:
            suggestions.append("Rephrase question for clearer binary outcome")
        
        if structure['specificity_score'] < 0.6:
            suggestions.append("Add specific metrics, dates, or price targets")
        
        for issue in structure['ambiguity_issues']:
            suggestions.append(f"Clarify ambiguous term: {issue}")
        
        # Category-specific suggestions
        if category == 'crypto_price':
            if '$' not in question:
                suggestions.append("Include specific price target (e.g., '$100K')")
        
        elif category == 'custom_events':
            suggestions.append("Define clear, verifiable resolution criteria")
            suggestions.append("Consider using UMA optimistic oracle for human verification")
        
        return suggestions
    
    def _assess_market_risks(self, question: str, category: str) -> Dict[str, Any]:
        """Assess various risks associated with the market"""
        
        risks = {
            'oracle_risk': 'low',
            'liquidity_risk': 'medium',
            'resolution_risk': 'low',
            'dispute_risk': 'low',
            'regulatory_risk': 'low'
        }
        
        # Adjust risks based on category
        if category == 'custom_events':
            risks.update({
                'resolution_risk': 'high',
                'dispute_risk': 'medium'
            })
        
        elif category == 'election_results':
            risks.update({
                'dispute_risk': 'high',
                'regulatory_risk': 'medium'
            })
        
        # Check for risk indicators in question
        question_lower = question.lower()
        
        if any(word in question_lower for word in ['subjective', 'opinion', 'interpretation']):
            risks['dispute_risk'] = 'high'
        
        if any(word in question_lower for word in ['illegal', 'banned', 'prohibited']):
            risks['regulatory_risk'] = 'high'
        
        return risks
    
    def _estimate_resolution_timeline(self, question: str) -> str:
        """Estimate how long after event resolution should occur"""
        
        question_lower = question.lower()
        
        # Immediate resolution for price-based questions
        if any(word in question_lower for word in ['price', '$', 'trading', 'close']):
            return 'immediate'
        
        # Sports events
        if any(word in question_lower for word in ['game', 'match', 'championship']):
            return '2_hours_after_event'
        
        # Elections
        if any(word in question_lower for word in ['election', 'vote', 'ballot']):
            return '24_hours_after_polls_close'
        
        # Corporate events
        if any(word in question_lower for word in ['announce', 'launch', 'release']):
            return '24_hours_after_announcement'
        
        return '24_hours_after_event'  # Default
    
    def _estimate_dispute_period(self, category: str) -> str:
        """Estimate appropriate dispute period"""
        
        dispute_periods = {
            'crypto_price': '1_hour',      # Fast price verification
            'stock_price': '2_hours',      # Stock data verification
            'sports_outcome': '24_hours',  # Allow for official results
            'election_results': '72_hours', # Complex verification needed
            'economic_data': '48_hours',   # Official data release delays
            'weather_events': '24_hours',  # Weather data verification
            'custom_events': '48_hours'    # Human verification time
        }
        
        return dispute_periods.get(category, '24_hours')
    
    def _estimate_minimum_stake(self, category: str) -> str:
        """Estimate minimum stake requirement"""
        
        stakes = {
            'crypto_price': '10',       # Low stakes for price predictions
            'stock_price': '25',        # Medium stakes for stocks
            'sports_outcome': '50',     # Medium-high for sports
            'election_results': '100',  # High stakes for elections
            'economic_data': '75',      # High stakes for Fed decisions
            'weather_events': '25',     # Medium stakes for weather
            'custom_events': '50'       # Medium stakes for custom
        }
        
        return stakes.get(category, '25')
    
    def _estimate_volume(self, category: str, context: Dict[str, Any]) -> str:
        """Estimate expected trading volume"""
        
        base_volume = {
            'crypto_price': 'high',
            'stock_price': 'medium',
            'sports_outcome': 'high',
            'election_results': 'very_high',
            'economic_data': 'medium',
            'weather_events': 'low',
            'custom_events': 'low'
        }.get(category, 'low')
        
        # Adjust for creator influence
        creator_influence = context.get('creator_influence', 0.5)
        if creator_influence > 0.8:
            volume_boost = {'low': 'medium', 'medium': 'high', 'high': 'very_high'}
            base_volume = volume_boost.get(base_volume, base_volume)
        
        return base_volume
    
    def _estimate_dispute_probability(self, category: str, question: str) -> float:
        """Estimate probability of disputes"""
        
        base_prob = {
            'crypto_price': 0.05,      # Very objective
            'stock_price': 0.03,       # Extremely objective  
            'sports_outcome': 0.08,    # Usually clear
            'election_results': 0.25,  # High dispute potential
            'economic_data': 0.10,     # Interpretation issues
            'weather_events': 0.12,    # Measurement disputes
            'custom_events': 0.30      # High subjectivity
        }.get(category, 0.15)
        
        # Adjust for ambiguous language
        question_lower = question.lower()
        ambiguous_count = sum(1 for word in ['significant', 'major', 'successful'] 
                             if word in question_lower)
        
        return min(base_prob + (ambiguous_count * 0.05), 0.5)
    
    def _extract_market_metrics(self, market_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract key metrics from existing market data"""
        
        return {
            'total_volume': market_data.get('volume', 0),
            'unique_traders': market_data.get('traders', 0),
            'liquidity': market_data.get('liquidity', 0),
            'price_stability': self._calculate_price_stability(market_data),
            'time_to_resolution': market_data.get('resolution_time'),
            'dispute_count': market_data.get('disputes', 0)
        }
    
    def _analyze_market_performance(self, market_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze market performance"""
        
        volume = market_data.get('volume', 0)
        expected_volume = market_data.get('expected_volume', volume)
        
        performance_ratio = volume / max(expected_volume, 1) if expected_volume > 0 else 0
        
        return {
            'volume_performance': 'good' if performance_ratio >= 0.8 else 'poor',
            'liquidity_health': self._assess_liquidity_health(market_data),
            'oracle_reliability': self._assess_oracle_reliability(market_data),
            'resolution_efficiency': self._assess_resolution_efficiency(market_data)
        }
    
    def _calculate_price_stability(self, market_data: Dict[str, Any]) -> float:
        """Calculate price stability score"""
        price_history = market_data.get('price_history', [])
        if len(price_history) < 2:
            return 1.0
        
        # Calculate volatility
        prices = [p['price'] for p in price_history]
        mean_price = sum(prices) / len(prices)
        variance = sum((p - mean_price) ** 2 for p in prices) / len(prices)
        volatility = (variance ** 0.5) / mean_price if mean_price > 0 else 1.0
        
        # Convert to stability (inverse of volatility)
        return max(0, 1.0 - volatility)
    
    def _assess_liquidity_health(self, market_data: Dict[str, Any]) -> str:
        """Assess liquidity health"""
        liquidity = market_data.get('liquidity', 0)
        volume = market_data.get('volume', 0)
        
        liquidity_ratio = liquidity / max(volume, 1) if volume > 0 else 0
        
        if liquidity_ratio >= 0.1:
            return 'healthy'
        elif liquidity_ratio >= 0.05:
            return 'moderate'
        else:
            return 'poor'
    
    def _assess_oracle_reliability(self, market_data: Dict[str, Any]) -> str:
        """Assess oracle performance for this market"""
        oracle_errors = market_data.get('oracle_errors', 0)
        oracle_delays = market_data.get('oracle_delays', 0)
        
        if oracle_errors == 0 and oracle_delays == 0:
            return 'excellent'
        elif oracle_errors <= 1 and oracle_delays <= 2:
            return 'good'
        else:
            return 'poor'
    
    def _assess_resolution_efficiency(self, market_data: Dict[str, Any]) -> str:
        """Assess how efficiently the market resolved"""
        expected_resolution_time = market_data.get('expected_resolution_hours', 24)
        actual_resolution_time = market_data.get('actual_resolution_hours', expected_resolution_time)
        
        efficiency_ratio = expected_resolution_time / max(actual_resolution_time, 1)
        
        if efficiency_ratio >= 0.9:
            return 'efficient'
        elif efficiency_ratio >= 0.7:
            return 'acceptable'
        else:
            return 'slow'
    
    def _suggest_market_improvements(
        self, market_data: Dict[str, Any], performance: Dict[str, Any]
    ) -> List[str]:
        """Suggest improvements for existing market"""
        
        suggestions = []
        
        if performance['liquidity_health'] == 'poor':
            suggestions.append("Increase market maker incentives to improve liquidity")
        
        if performance['volume_performance'] == 'poor':
            suggestions.append("Consider marketing campaign or creator rewards")
        
        if performance['oracle_reliability'] == 'poor':
            suggestions.append("Switch to more reliable oracle provider")
        
        if performance['resolution_efficiency'] == 'slow':
            suggestions.append("Optimize resolution timeline and oracle configuration")
        
        disputes = market_data.get('disputes', 0)
        if disputes > 2:
            suggestions.append("Clarify resolution criteria to reduce disputes")
        
        return suggestions
    
    def _calculate_market_health_score(self, market_data: Dict[str, Any]) -> float:
        """Calculate overall market health score"""
        
        factors = [
            ('volume', min(market_data.get('volume', 0) / 10000, 1.0)),
            ('liquidity', min(market_data.get('liquidity', 0) / 5000, 1.0)),
            ('stability', self._calculate_price_stability(market_data)),
            ('oracle_reliability', {'excellent': 1.0, 'good': 0.8, 'poor': 0.3}.get(
                self._assess_oracle_reliability(market_data), 0.5))
        ]
        
        weights = [0.3, 0.25, 0.25, 0.2]  # Volume, liquidity, stability, oracle
        score = sum(factor * weight for (_, factor), weight in zip(factors, weights))
        
        return score
    
    def _analyze_oracle_performance(self, market_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze oracle performance for the market"""
        
        return {
            'provider': market_data.get('oracle_provider'),
            'response_time_avg': market_data.get('oracle_response_time', 0),
            'error_rate': market_data.get('oracle_error_rate', 0),
            'cost_efficiency': market_data.get('oracle_cost', 0),
            'reliability_score': self._assess_oracle_reliability(market_data)
        }