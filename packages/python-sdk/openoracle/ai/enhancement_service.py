"""
AI Enhancement Service for complex routing decisions
"""

import json
import logging
from typing import Optional, Dict, Any
import httpx

from .routing_engine import RoutingEngine
from ..schemas.oracle_schemas import (
    OracleRoutingRequest, OracleRoutingResponse,
    AIEnhancementRequest, AIEnhancementResponse
)

logger = logging.getLogger(__name__)


class EnhancementService:
    """AI-enhanced routing using GPT models for complex decisions"""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "openai/gpt-4o-mini"):
        self.routing_engine = RoutingEngine()
        self.api_key = api_key
        self.base_url = "https://openrouter.ai/api/v1"
        self.model = model
        
    async def route_with_ai_enhancement(
        self, request: OracleRoutingRequest
    ) -> OracleRoutingResponse:
        """
        Route with AI enhancement for complex questions
        """
        # Get basic routing result
        basic_response = await self.routing_engine.route_question(request)
        
        # Check if AI enhancement is needed and available
        if not self._should_enhance(request, basic_response) or not self.api_key:
            return basic_response
        
        try:
            # Enhance with AI
            enhanced_response = await self._enhance_with_ai(request, basic_response)
            return enhanced_response
        except Exception as e:
            logger.warning(f"AI enhancement failed: {e}")
            return basic_response
    
    def _should_enhance(
        self, request: OracleRoutingRequest, response: OracleRoutingResponse
    ) -> bool:
        """Determine if AI enhancement is beneficial"""
        
        # Enhance if confidence is low
        if response.confidence_score < 0.7:
            return True
        
        # Enhance for complex questions
        question = request.question.lower()
        complexity_indicators = [
            ' and ', ' or ', ' but ', ' however ', ' unless ',
            'multiple', 'several', 'various', 'conditional'
        ]
        
        if any(indicator in question for indicator in complexity_indicators):
            return True
        
        # Enhance for custom/events categories (often ambiguous)
        if response.data_type and response.data_type.value in ['custom', 'events']:
            return True
        
        # Enhance for high-value decisions
        if response.estimated_cost_usd and response.estimated_cost_usd > 50:
            return True
        
        return False
    
    async def _enhance_with_ai(
        self, request: OracleRoutingRequest, basic_response: OracleRoutingResponse
    ) -> OracleRoutingResponse:
        """Enhance routing decision with AI analysis"""
        
        # Create enhancement request
        ai_request = AIEnhancementRequest(
            question=request.question,
            current_oracle=basic_response.selected_oracle,
            current_confidence=basic_response.confidence_score,
            current_reasoning=basic_response.reasoning
        )
        
        # Get response schema for structured output
        schema = AIEnhancementResponse.model_json_schema()
        
        # Build comprehensive prompt
        prompt = self._build_enhancement_prompt(ai_request, schema)
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
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
                                "content": self._get_system_prompt()
                            },
                            {
                                "role": "user",
                                "content": prompt
                            }
                        ],
                        "temperature": 0.2,  # Low temperature for consistent analysis
                        "max_tokens": 800,
                        "response_format": {"type": "json_object"}
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    ai_content = result["choices"][0]["message"]["content"]
                    
                    # Parse and validate AI response
                    ai_data = json.loads(ai_content)
                    ai_enhancement = AIEnhancementResponse.model_validate(ai_data)
                    
                    # Apply AI enhancements to basic response
                    return self._apply_enhancements(basic_response, ai_enhancement)
                else:
                    logger.error(f"AI API error: {response.status_code} - {response.text}")
                    
        except Exception as e:
            logger.error(f"AI enhancement error: {e}")
            raise
        
        return basic_response
    
    def _get_system_prompt(self) -> str:
        """Get system prompt for AI enhancement"""
        return """You are an expert in blockchain oracles and prediction markets. 
        
        Your role is to analyze prediction market questions and recommend the optimal oracle solution.
        You have deep knowledge of:
        - Chainlink: Price feeds, sports data (TheRundown), weather (AccuWeather), VRF
        - Pyth: Real-time crypto/stock prices, sub-second updates, pull-based
        - Band Protocol: Cross-chain data, custom API requests
        - UMA: Optimistic oracle with human verification, disputes, complex events
        - API3: First-party oracles, signed data, weather (NOAA), NFTs
        
        Always respond with valid JSON matching the provided schema.
        Focus on accuracy, cost-effectiveness, and reliability for the specific use case."""
    
    def _build_enhancement_prompt(
        self, ai_request: AIEnhancementRequest, schema: Dict[str, Any]
    ) -> str:
        """Build detailed prompt for AI analysis"""
        
        return f"""
        Analyze this prediction market question and optimize the oracle selection:
        
        **Question:** {ai_request.question}
        
        **Current Analysis:**
        - Selected Oracle: {ai_request.current_oracle or 'None'}
        - Confidence: {ai_request.current_confidence:.1%}
        - Reasoning: {ai_request.current_reasoning or 'No reasoning provided'}
        
        **Oracle Capabilities Summary:**
        
        🔗 **Chainlink** - Most reliable (99% uptime)
        - Best for: Price feeds, sports betting, weather events
        - Specialties: TheRundown sports data, AccuWeather API
        - Cost: ~$0.50, Latency: 500ms
        
        ⚡ **Pyth Network** - Fastest price updates
        - Best for: Crypto prices, real-time trading
        - Specialties: Sub-second updates, major exchange data
        - Cost: ~$0.10, Latency: 100ms
        
        🌐 **Band Protocol** - Most flexible
        - Best for: Custom data, cross-chain requests
        - Specialties: Any API endpoint, Cosmos ecosystem
        - Cost: ~$0.30, Latency: 1000ms
        
        🔍 **UMA Optimistic Oracle** - Human verification
        - Best for: Elections, court decisions, complex events
        - Specialties: Dispute resolution, human validators
        - Cost: ~$100 (includes bond), Latency: 2 hours
        
        🔌 **API3** - First-party data
        - Best for: Weather (NOAA), NFT floors, signed data
        - Specialties: Direct API connections, no intermediaries
        - Cost: ~$0.25, Latency: 800ms
        
        **Analysis Requirements:**
        1. Consider the question type (price, sports, election, weather, custom)
        2. Evaluate data source reliability needs
        3. Consider cost vs. accuracy tradeoffs
        4. Account for resolution timeline requirements
        5. Think about dispute/verification mechanisms needed
        
        **Response Schema:**
        {json.dumps(schema, indent=2)}
        
        Provide your analysis as JSON matching this schema exactly.
        """
    
    def _apply_enhancements(
        self, basic_response: OracleRoutingResponse, ai_enhancement: AIEnhancementResponse
    ) -> OracleRoutingResponse:
        """Apply AI enhancements to the basic response"""
        
        # If AI suggests a different oracle, use it
        if ai_enhancement.oracle != basic_response.selected_oracle:
            logger.info(f"AI suggested oracle change: {basic_response.selected_oracle} -> {ai_enhancement.oracle}")
        
        # Combine reasoning
        enhanced_reasoning = f"{ai_enhancement.reasoning}"
        if basic_response.reasoning and ai_enhancement.reasoning != basic_response.reasoning:
            enhanced_reasoning += f" (Enhanced from: {basic_response.reasoning})"
        
        # Calculate enhanced confidence
        enhanced_confidence = min(
            basic_response.confidence_score + ai_enhancement.confidence_boost,
            1.0
        )
        
        # Update oracle config if oracle changed
        oracle_config = basic_response.oracle_config
        if ai_enhancement.oracle != basic_response.selected_oracle:
            # Would need to rebuild config for new oracle
            # For now, keep existing config structure
            if oracle_config:
                oracle_config['provider'] = ai_enhancement.oracle.value
        
        # Create enhanced response
        return OracleRoutingResponse(
            can_resolve=True,
            selected_oracle=ai_enhancement.oracle or basic_response.selected_oracle,
            reasoning=enhanced_reasoning,
            oracle_config=oracle_config,
            alternatives=basic_response.alternatives,
            data_type=ai_enhancement.data_type or basic_response.data_type,
            required_feeds=ai_enhancement.feeds or basic_response.required_feeds,
            estimated_cost_usd=basic_response.estimated_cost_usd,
            estimated_latency_ms=basic_response.estimated_latency_ms,
            confidence_score=enhanced_confidence,
            resolution_method=basic_response.resolution_method,
            update_frequency=basic_response.update_frequency
        )
    
    async def analyze_question_complexity(self, question: str) -> Dict[str, Any]:
        """Analyze question complexity for routing optimization"""
        
        if not self.api_key:
            return {'complexity': 'medium', 'factors': []}
        
        prompt = f"""
        Analyze the complexity of this prediction market question:
        
        Question: {question}
        
        Consider:
        1. Number of conditions/variables
        2. Ambiguity in resolution criteria
        3. Data source availability
        4. Verification difficulty
        5. Timeline complexity
        
        Respond with JSON:
        {{
            "complexity": "low|medium|high",
            "factors": ["list", "of", "complexity", "factors"],
            "resolution_challenges": ["potential", "challenges"],
            "recommended_oracle_features": ["needed", "features"]
        }}
        """
        
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": "You are an expert in prediction market complexity analysis. Always respond with valid JSON."},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.1,
                        "max_tokens": 400,
                        "response_format": {"type": "json_object"}
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return json.loads(result["choices"][0]["message"]["content"])
                    
        except Exception as e:
            logger.warning(f"Complexity analysis failed: {e}")
        
        return {'complexity': 'medium', 'factors': ['analysis_unavailable']}