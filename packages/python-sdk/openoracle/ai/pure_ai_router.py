"""
Pure AI Router - Direct AI-based oracle selection without complex logic
Uses GPT-4o-mini and o3-mini for pure AI determination
"""

import json
import logging
from typing import Dict, Any, Optional
import httpx

from ..schemas.oracle_schemas import (
    OracleProvider, DataCategory, OracleRoutingRequest, OracleRoutingResponse
)

logger = logging.getLogger(__name__)


class PureAIRouter:
    """Pure AI-based oracle routing without rule-based logic"""
    
    def __init__(self, api_key: str, model: str = "openai/gpt-4o-mini"):
        self.api_key = api_key
        self.base_url = "https://openrouter.ai/api/v1"
        self.model = model
        self.backup_model = "openai/o3-mini"
        
    async def route_question(self, request: OracleRoutingRequest) -> OracleRoutingResponse:
        """
        Pure AI routing - let AI decide everything
        """
        try:
            # Use primary model (GPT-4o-mini)
            response = await self._get_ai_routing_decision(request, self.model)
            if response:
                return response
            
            # Fallback to o3-mini if primary fails
            logger.info("Primary model failed, trying o3-mini")
            response = await self._get_ai_routing_decision(request, self.backup_model)
            if response:
                return response
            
            # Final fallback
            return OracleRoutingResponse(
                can_resolve=False,
                reasoning="AI routing services unavailable",
                confidence_score=0.0
            )
            
        except Exception as e:
            logger.error(f"Pure AI routing failed: {e}")
            return OracleRoutingResponse(
                can_resolve=False,
                reasoning=f"AI routing error: {str(e)}",
                confidence_score=0.0
            )
    
    async def _get_ai_routing_decision(
        self, request: OracleRoutingRequest, model: str
    ) -> Optional[OracleRoutingResponse]:
        """Get pure AI decision for oracle routing"""
        
        # Build comprehensive prompt for AI
        prompt = self._build_pure_ai_prompt(request)
        
        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": model,
                        "messages": [
                            {
                                "role": "system",
                                "content": self._get_pure_ai_system_prompt()
                            },
                            {
                                "role": "user",
                                "content": prompt
                            }
                        ],
                        "temperature": 0.1,  # Low temperature for consistent decisions
                        "max_tokens": 1000,
                        "response_format": {"type": "json_object"}
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    ai_content = result["choices"][0]["message"]["content"]
                    
                    # Parse AI response
                    ai_data = json.loads(ai_content)
                    return self._convert_ai_response_to_oracle_response(ai_data)
                else:
                    logger.error(f"AI API error: {response.status_code}")
                    return None
                    
        except Exception as e:
            logger.error(f"AI request failed with {model}: {e}")
            return None
    
    def _get_pure_ai_system_prompt(self) -> str:
        """System prompt for pure AI oracle selection"""
        return """You are an expert oracle routing AI. Your job is to analyze prediction market questions and select the optimal oracle provider.

Available Oracle Providers:
- CHAINLINK: Most reliable, price feeds, sports data via TheRundown, weather via AccuWeather, 99% uptime, $0.50 cost, 500ms latency
- PYTH: Real-time crypto/stock prices, sub-second updates, $0.10 cost, 100ms latency, best for price feeds
- UMA: Optimistic oracle with human verification, perfect for elections/complex events, $100 cost (includes bond), 2 hour latency
- BAND: Cross-chain data, custom API requests, flexible, $0.30 cost, 1000ms latency
- API3: First-party oracles, weather (NOAA), NFT floors, signed data, $0.25 cost, 800ms latency

Make your decision based on:
1. Question type and requirements
2. Data source reliability needs
3. Resolution timeline requirements
4. Cost vs accuracy tradeoffs
5. Verification mechanisms needed

Always respond with valid JSON matching the exact schema provided."""
    
    def _build_pure_ai_prompt(self, request: OracleRoutingRequest) -> str:
        """Build comprehensive prompt for AI analysis"""
        
        constraints = []
        if request.max_cost_usd:
            constraints.append(f"Maximum cost: ${request.max_cost_usd}")
        if request.max_latency_ms:
            constraints.append(f"Maximum latency: {request.max_latency_ms}ms")
        if request.required_chains:
            constraints.append(f"Required chains: {', '.join(request.required_chains)}")
        if request.preferred_providers:
            providers = [p.value for p in request.preferred_providers]
            constraints.append(f"Preferred providers: {', '.join(providers)}")
        
        constraints_text = "\n".join(f"- {c}" for c in constraints) if constraints else "- No specific constraints"
        
        return f"""
Analyze this prediction market question and select the optimal oracle:

QUESTION: "{request.question}"

CONSTRAINTS:
{constraints_text}

CATEGORY HINT: {request.category_hint.value if request.category_hint else "None provided"}

Analyze the question and respond with JSON in this EXACT format:
{{
    "can_resolve": true/false,
    "selected_oracle": "CHAINLINK|PYTH|UMA|BAND|API3",
    "reasoning": "Clear explanation of why this oracle was selected",
    "confidence_score": 0.0-1.0,
    "data_type": "PRICE|SPORTS|WEATHER|ELECTION|ECONOMIC|CUSTOM|EVENTS|NFT|STOCKS|FOREX|COMMODITIES|RANDOM",
    "required_feeds": ["list", "of", "data", "feeds"],
    "estimated_cost_usd": 0.0,
    "estimated_latency_ms": 0,
    "oracle_config": {{
        "provider": "oracle_name",
        "additional_config": "as_needed"
    }}
}}

Focus on:
1. What type of prediction is this?
2. What data sources are needed?
3. How quickly does it need to resolve?
4. What level of verification is required?
5. Which oracle best fits these requirements?

Make your best judgment based on the question content and oracle capabilities.
"""
    
    def _convert_ai_response_to_oracle_response(
        self, ai_data: Dict[str, Any]
    ) -> OracleRoutingResponse:
        """Convert AI JSON response to OracleRoutingResponse"""
        
        try:
            # Parse oracle provider
            oracle_str = ai_data.get("selected_oracle", "").upper()
            selected_oracle = None
            if oracle_str in ["CHAINLINK", "PYTH", "UMA", "BAND", "API3"]:
                selected_oracle = OracleProvider(oracle_str)
            
            # Parse data category
            category_str = ai_data.get("data_type", "").upper()
            data_type = None
            valid_categories = [
                "PRICE", "SPORTS", "WEATHER", "ELECTION", "ECONOMIC", 
                "CUSTOM", "EVENTS", "NFT", "STOCKS", "FOREX", "COMMODITIES", "RANDOM"
            ]
            if category_str in valid_categories:
                data_type = DataCategory(category_str)
            
            return OracleRoutingResponse(
                can_resolve=ai_data.get("can_resolve", False),
                selected_oracle=selected_oracle,
                reasoning=ai_data.get("reasoning", "AI decision"),
                confidence_score=float(ai_data.get("confidence_score", 0.0)),
                oracle_config=ai_data.get("oracle_config", {}),
                alternatives=None,  # Pure AI mode doesn't provide alternatives
                data_type=data_type,
                required_feeds=ai_data.get("required_feeds", []),
                estimated_cost_usd=ai_data.get("estimated_cost_usd", 0.0),
                estimated_latency_ms=int(ai_data.get("estimated_latency_ms", 0)),
                resolution_method="ai_determined",
                update_frequency=None  # AI will determine this implicitly
            )
            
        except Exception as e:
            logger.error(f"Failed to convert AI response: {e}")
            return OracleRoutingResponse(
                can_resolve=False,
                reasoning=f"AI response parsing error: {str(e)}",
                confidence_score=0.0
            )


class PureAgentRouter:
    """Pure agent-based routing using specialized AI agents"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.pure_ai_router = PureAIRouter(api_key)
        
        # Specialized agent prompts
        self.agent_prompts = {
            "crypto_agent": """You are a crypto prediction market specialist. 
            Focus on cryptocurrency price movements, DeFi protocols, and blockchain events.
            Prefer Pyth for real-time crypto prices, Chainlink for established assets.""",
            
            "sports_agent": """You are a sports betting specialist.
            Focus on game outcomes, player performance, and tournament results.
            Prefer Chainlink for official sports data via TheRundown partnership.""",
            
            "politics_agent": """You are a political prediction market specialist.
            Focus on elections, policy decisions, and governmental actions.
            Prefer UMA for human-verified election results and complex political events.""",
            
            "economics_agent": """You are an economic prediction market specialist.
            Focus on Fed decisions, economic indicators, and market movements.
            Use UMA for Fed decisions, Chainlink for automated economic data.""",
            
            "events_agent": """You are a general events prediction specialist.
            Focus on corporate announcements, product launches, and custom events.
            Use UMA for complex verification, Band for custom data needs."""
        }
    
    async def route_with_specialized_agent(
        self, request: OracleRoutingRequest
    ) -> OracleRoutingResponse:
        """Route using specialized agents based on question type"""
        
        # First, determine which agent to use
        agent_type = await self._select_agent(request.question)
        
        # Use the specialized agent
        return await self._route_with_agent(request, agent_type)
    
    async def _select_agent(self, question: str) -> str:
        """Select the best agent for the question type"""
        
        question_lower = question.lower()
        
        # Simple keyword-based agent selection (could be enhanced with AI)
        if any(word in question_lower for word in ['btc', 'eth', 'crypto', 'bitcoin', 'ethereum', 'defi']):
            return "crypto_agent"
        elif any(word in question_lower for word in ['game', 'win', 'sport', 'nfl', 'nba', 'championship']):
            return "sports_agent"
        elif any(word in question_lower for word in ['election', 'vote', 'president', 'congress', 'senate']):
            return "politics_agent"
        elif any(word in question_lower for word in ['fed', 'interest rate', 'inflation', 'gdp', 'unemployment']):
            return "economics_agent"
        else:
            return "events_agent"
    
    async def _route_with_agent(
        self, request: OracleRoutingRequest, agent_type: str
    ) -> OracleRoutingResponse:
        """Route using a specialized agent"""
        
        # Modify the system prompt to include agent specialization
        original_router = self.pure_ai_router
        
        # Create a specialized prompt
        agent_prompt = self.agent_prompts.get(agent_type, self.agent_prompts["events_agent"])
        specialized_prompt = f"""
{original_router._get_pure_ai_system_prompt()}

AGENT SPECIALIZATION:
{agent_prompt}

Apply your specialized knowledge to make the best oracle selection for this question type.
"""
        
        # Temporarily override the system prompt
        original_get_prompt = original_router._get_pure_ai_system_prompt
        original_router._get_pure_ai_system_prompt = lambda: specialized_prompt
        
        try:
            result = await original_router.route_question(request)
            # Add agent info to reasoning
            if result.reasoning:
                result.reasoning = f"[{agent_type.upper()}] {result.reasoning}"
            return result
        finally:
            # Restore original method
            original_router._get_pure_ai_system_prompt = original_get_prompt