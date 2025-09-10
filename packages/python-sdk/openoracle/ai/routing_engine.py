"""
Oracle Routing Engine with AI-enhanced decision making
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from decimal import Decimal

from .question_analyzer import QuestionAnalyzer
from ..schemas.oracle_schemas import (
    DataCategory, OracleProvider, UpdateFrequency,
    OracleRoutingRequest, OracleRoutingResponse
)

logger = logging.getLogger(__name__)


class RoutingEngine:
    """Core engine for routing questions to optimal oracles"""
    
    # Enhanced oracle capabilities matrix
    ORACLE_CAPABILITIES = {
        OracleProvider.CHAINLINK: {
            'categories': [
                DataCategory.PRICE, DataCategory.SPORTS, DataCategory.WEATHER,
                DataCategory.RANDOM, DataCategory.STOCKS, DataCategory.FOREX
            ],
            'update_freq': UpdateFrequency.HIGH_FREQ,
            'chains': ['ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'bnb'],
            'latency_ms': 500,
            'reliability': 0.99,
            'cost_usd': Decimal("0.50"),
            'specialties': {
                'sports': ['TheRundown', 'SportsdataIO'],
                'weather': ['AccuWeather', 'OpenWeather'],
                'stocks': ['Tiingo', 'AlphaVantage']
            }
        },
        OracleProvider.PYTH: {
            'categories': [
                DataCategory.PRICE, DataCategory.STOCKS, DataCategory.FOREX,
                DataCategory.COMMODITIES
            ],
            'update_freq': UpdateFrequency.REALTIME,
            'chains': ['solana', 'ethereum', 'arbitrum', 'optimism', 'base'],
            'latency_ms': 100,
            'reliability': 0.98,
            'cost_usd': Decimal("0.10"),
            'specialties': {
                'crypto': ['real_time_feeds'],
                'stocks': ['NYSE', 'NASDAQ'],
                'forex': ['major_pairs']
            }
        },
        OracleProvider.BAND: {
            'categories': [
                DataCategory.PRICE, DataCategory.STOCKS, DataCategory.FOREX,
                DataCategory.COMMODITIES, DataCategory.CUSTOM
            ],
            'update_freq': UpdateFrequency.MEDIUM_FREQ,
            'chains': ['cosmos', 'ethereum', 'binance', 'polygon'],
            'latency_ms': 1000,
            'reliability': 0.95,
            'cost_usd': Decimal("0.30"),
            'specialties': {
                'custom': ['any_api_endpoint'],
                'cross_chain': ['cosmos_ecosystem']
            }
        },
        OracleProvider.UMA: {
            'categories': [
                DataCategory.CUSTOM, DataCategory.EVENTS, DataCategory.ECONOMIC,
                DataCategory.ELECTION
            ],
            'update_freq': UpdateFrequency.ON_DEMAND,
            'chains': ['ethereum', 'polygon', 'arbitrum'],
            'latency_ms': 7200000,  # 2 hours for optimistic oracle
            'reliability': 0.97,
            'cost_usd': Decimal("100.00"),  # Includes bond
            'specialties': {
                'elections': ['human_verified'],
                'events': ['dispute_resolution'],
                'economic': ['fed_decisions']
            }
        },
        OracleProvider.API3: {
            'categories': [
                DataCategory.PRICE, DataCategory.WEATHER, DataCategory.SPORTS,
                DataCategory.CUSTOM, DataCategory.NFT
            ],
            'update_freq': UpdateFrequency.MEDIUM_FREQ,
            'chains': ['ethereum', 'polygon', 'avalanche', 'bnb', 'arbitrum'],
            'latency_ms': 800,
            'reliability': 0.96,
            'cost_usd': Decimal("0.25"),
            'specialties': {
                'weather': ['direct_noaa'],
                'nft': ['opensea_floor', 'blur_floor']
            }
        }
    }
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.analyzer = QuestionAnalyzer()
        self.config = config or {}
        
    async def route_question(self, request: OracleRoutingRequest) -> OracleRoutingResponse:
        """
        Route a question to the most appropriate oracle
        """
        try:
            # Analyze the question
            category, base_confidence = self.analyzer.analyze_question(request.question)
            requirements = self.analyzer.extract_data_requirements(request.question)
            
            # Override category if hint provided
            if request.category_hint:
                category = request.category_hint
                base_confidence = max(base_confidence, 0.8)  # Boost confidence for hints
            
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
                    reasoning=f"No oracle supports {category.value} data with your requirements",
                    confidence_score=base_confidence,
                    data_type=category
                )
            
            # Select the best oracle using enhanced logic
            selected_oracle, reasoning = self._select_best_oracle(
                suitable_oracles, category, requirements
            )
            
            # Build configuration
            oracle_config = self._build_oracle_config(selected_oracle, category, requirements)
            
            # Calculate metrics
            capabilities = self.ORACLE_CAPABILITIES[selected_oracle]
            estimated_cost = capabilities['cost_usd']
            estimated_latency = capabilities['latency_ms']
            
            # Boost confidence based on oracle specialization
            confidence_boost = self._calculate_confidence_boost(
                selected_oracle, category, requirements
            )
            final_confidence = min(base_confidence + confidence_boost, 1.0)
            
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
                confidence_score=final_confidence,
                resolution_method=self._get_resolution_method(selected_oracle),
                update_frequency=capabilities['update_freq']
            )
            
        except Exception as e:
            logger.error(f"Routing failed: {e}")
            return OracleRoutingResponse(
                can_resolve=False,
                reasoning=f"Routing error: {str(e)}",
                confidence_score=0.0
            )
    
    def _find_suitable_oracles(
        self,
        category: DataCategory,
        required_chains: Optional[List[str]],
        max_latency: Optional[int],
        max_cost: Optional[Decimal],
        preferred_providers: Optional[List[OracleProvider]]
    ) -> List[OracleProvider]:
        """Find oracles that meet all requirements"""
        suitable = []
        
        for provider, capabilities in self.ORACLE_CAPABILITIES.items():
            # Check preferred providers first
            if preferred_providers and provider not in preferred_providers:
                continue
            
            # Category support check
            if category not in capabilities['categories']:
                continue
            
            # Chain support check
            if required_chains:
                supported_chains = set(capabilities['chains'])
                required_chains_set = set(chain.lower() for chain in required_chains)
                if not required_chains_set.intersection(supported_chains):
                    continue
            
            # Latency requirement check
            if max_latency and capabilities['latency_ms'] > max_latency:
                continue
            
            # Cost requirement check
            if max_cost and capabilities['cost_usd'] > max_cost:
                continue
            
            suitable.append(provider)
        
        # Sort by reliability and specialization
        return self._sort_oracles_by_preference(suitable, category)
    
    def _sort_oracles_by_preference(
        self, oracles: List[OracleProvider], category: DataCategory
    ) -> List[OracleProvider]:
        """Sort oracles by preference for the given category"""
        
        def preference_score(oracle: OracleProvider) -> float:
            capabilities = self.ORACLE_CAPABILITIES[oracle]
            score = capabilities['reliability']
            
            # Boost score for category specialization
            if category.value in capabilities.get('specialties', {}):
                score += 0.1
            
            # Prefer faster oracles (inverse latency)
            latency_score = 1.0 / (capabilities['latency_ms'] / 1000.0 + 1.0)
            score += latency_score * 0.05
            
            return score
        
        return sorted(oracles, key=preference_score, reverse=True)
    
    def _select_best_oracle(
        self,
        suitable_oracles: List[OracleProvider],
        category: DataCategory,
        requirements: Dict[str, Any]
    ) -> Tuple[OracleProvider, str]:
        """Select the best oracle with detailed reasoning"""
        
        if not suitable_oracles:
            return None, "No suitable oracles available"
        
        question = requirements.get('original_question', '').lower()
        assets = requirements.get('assets', [])
        
        # === CRYPTO PRICE MARKETS ===
        if category == DataCategory.PRICE and assets:
            crypto_assets = ['BTC', 'ETH', 'SOL', 'AVAX']
            if any(asset in crypto_assets for asset in assets):
                if OracleProvider.PYTH in suitable_oracles:
                    return (
                        OracleProvider.PYTH,
                        f"Pyth Network selected for {', '.join(assets)} - provides sub-second "
                        f"price updates from major exchanges with 100ms latency"
                    )
                elif OracleProvider.CHAINLINK in suitable_oracles:
                    return (
                        OracleProvider.CHAINLINK,
                        f"Chainlink selected for {', '.join(assets)} - industry-leading "
                        f"price aggregation with 99% uptime"
                    )
        
        # === SPORTS BETTING ===
        if category == DataCategory.SPORTS:
            if OracleProvider.CHAINLINK in suitable_oracles:
                return (
                    OracleProvider.CHAINLINK,
                    "Chainlink selected for sports data - exclusive partnerships with "
                    "TheRundown and SportsdataIO for official game results"
                )
            elif OracleProvider.API3 in suitable_oracles:
                return (
                    OracleProvider.API3,
                    "API3 selected for sports data - first-party oracle connections "
                    "to major sports APIs"
                )
        
        # === POLITICAL/ELECTION MARKETS ===
        if category == DataCategory.ELECTION:
            if OracleProvider.UMA in suitable_oracles:
                return (
                    OracleProvider.UMA,
                    "UMA Optimistic Oracle selected for election results - human "
                    "verification ensures accuracy with dispute resolution mechanism"
                )
        
        # === ECONOMIC DATA ===
        if category == DataCategory.ECONOMIC:
            fed_keywords = ['fed', 'federal reserve', 'powell', 'interest rate', 'fomc']
            if any(keyword in question for keyword in fed_keywords):
                if OracleProvider.UMA in suitable_oracles:
                    return (
                        OracleProvider.UMA,
                        "UMA selected for Fed decisions - optimistic oracle with "
                        "human verification of official FOMC statements"
                    )
            elif OracleProvider.CHAINLINK in suitable_oracles:
                return (
                    OracleProvider.CHAINLINK,
                    "Chainlink selected for economic data - automated feeds from "
                    "official government sources"
                )
        
        # === WEATHER EVENTS ===
        if category == DataCategory.WEATHER:
            if OracleProvider.API3 in suitable_oracles:
                return (
                    OracleProvider.API3,
                    "API3 selected for weather data - direct first-party connections "
                    "to NOAA and AccuWeather"
                )
            elif OracleProvider.CHAINLINK in suitable_oracles:
                return (
                    OracleProvider.CHAINLINK,
                    "Chainlink selected for weather data - verified AccuWeather "
                    "integration with high reliability"
                )
        
        # === CUSTOM/COMPLEX EVENTS ===
        if category in [DataCategory.CUSTOM, DataCategory.EVENTS]:
            # Corporate events
            corporate_keywords = ['announce', 'launch', 'ipo', 'earnings', 'merger']
            if any(keyword in question for keyword in corporate_keywords):
                if OracleProvider.UMA in suitable_oracles:
                    return (
                        OracleProvider.UMA,
                        "UMA selected for corporate events - optimistic oracle "
                        "ensures accurate verification of official announcements"
                    )
            
            # Social media events
            social_keywords = ['tweet', 'post', 'follower', 'ban', 'suspend']
            if any(keyword in question for keyword in social_keywords):
                if OracleProvider.BAND in suitable_oracles:
                    return (
                        OracleProvider.BAND,
                        "Band Protocol selected for social media data - flexible "
                        "API integration for real-time social metrics"
                    )
        
        # === NFT MARKETS ===
        if category == DataCategory.NFT:
            if OracleProvider.API3 in suitable_oracles:
                return (
                    OracleProvider.API3,
                    "API3 selected for NFT floor prices - direct OpenSea and "
                    "Blur marketplace connections"
                )
        
        # Default selection with reasoning
        best_oracle = suitable_oracles[0]
        capabilities = self.ORACLE_CAPABILITIES[best_oracle]
        
        reasoning = (
            f"{best_oracle.value} selected as optimal choice - "
            f"{capabilities['reliability']:.0%} reliability, "
            f"{capabilities['latency_ms']}ms latency, "
            f"${capabilities['cost_usd']} estimated cost"
        )
        
        return best_oracle, reasoning
    
    def _build_oracle_config(
        self,
        provider: OracleProvider,
        category: DataCategory,
        requirements: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Build provider-specific configuration"""
        
        base_config = {
            'provider': provider.value,
            'category': category.value,
            'requirements': requirements
        }
        
        if provider == OracleProvider.CHAINLINK:
            return {
                **base_config,
                'feed_type': 'price_feed' if category == DataCategory.PRICE else 'data_feed',
                'pairs': [f"{asset}/USD" for asset in requirements.get('assets', [])],
                'aggregation': 'median',
                'heartbeat': 3600  # 1 hour
            }
        
        elif provider == OracleProvider.PYTH:
            return {
                **base_config,
                'update_type': 'pull_based',
                'confidence_interval': True,
                'feed_ids': requirements.get('assets', [])
            }
        
        elif provider == OracleProvider.UMA:
            return {
                **base_config,
                'oracle_type': 'optimistic',
                'liveness_period': 7200,  # 2 hours
                'bond_amount': "100",  # USDC
                'dispute_mechanism': True
            }
        
        elif provider == OracleProvider.BAND:
            return {
                **base_config,
                'request_type': 'custom',
                'data_sources': requirements.get('assets', []),
                'aggregation_method': 'weighted_average'
            }
        
        elif provider == OracleProvider.API3:
            return {
                **base_config,
                'api_type': 'first_party',
                'signed_data': True,
                'data_feeds': requirements.get('assets', [])
            }
        
        return base_config
    
    def _calculate_confidence_boost(
        self,
        oracle: OracleProvider,
        category: DataCategory,
        requirements: Dict[str, Any]
    ) -> float:
        """Calculate confidence boost based on oracle specialization"""
        
        capabilities = self.ORACLE_CAPABILITIES[oracle]
        boost = 0.0
        
        # Specialization boost
        specialties = capabilities.get('specialties', {})
        if category.value in specialties:
            boost += 0.15
        
        # Asset-specific boost for price categories
        if category == DataCategory.PRICE:
            assets = requirements.get('assets', [])
            if assets:
                # Pyth boost for crypto
                if oracle == OracleProvider.PYTH:
                    crypto_assets = ['BTC', 'ETH', 'SOL', 'AVAX']
                    if any(asset in crypto_assets for asset in assets):
                        boost += 0.10
                
                # Chainlink boost for traditional assets
                elif oracle == OracleProvider.CHAINLINK:
                    stock_assets = ['AAPL', 'TSLA', 'MSFT', 'GOOGL']
                    if any(asset in stock_assets for asset in assets):
                        boost += 0.10
        
        # High reliability boost
        if capabilities['reliability'] >= 0.98:
            boost += 0.05
        
        return boost
    
    def _get_resolution_method(self, provider: OracleProvider) -> str:
        """Get resolution method for the provider"""
        methods = {
            OracleProvider.CHAINLINK: "aggregated",
            OracleProvider.PYTH: "direct_pull",
            OracleProvider.BAND: "cross_chain_aggregated",
            OracleProvider.UMA: "optimistic_human_verified",
            OracleProvider.API3: "first_party_signed"
        }
        return methods.get(provider, "automated")