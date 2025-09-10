"""
ReAct Oracle Agent with Chain-of-Thought Reasoning
Implements a thinking model for oracle selection decisions
"""

import json
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum
from pydantic import BaseModel, Field
import httpx

from .schemas.oracle_schemas import (
    OracleProvider,
    DataCategory,
    OracleRoutingRequest,
    OracleRoutingResponse
)

logger = logging.getLogger(__name__)

# ============ Thinking Model Schemas ============

class ThoughtStep(BaseModel):
    """Single step in chain-of-thought reasoning"""
    step_number: int
    thought: str = Field(..., description="What I'm thinking about")
    observation: str = Field(..., description="What I observe from the data")
    action: str = Field(..., description="What action I'll take")
    result: Optional[str] = Field(None, description="Result of the action")

class ReasoningChain(BaseModel):
    """Complete reasoning chain for oracle selection"""
    question: str
    thoughts: List[ThoughtStep]
    final_decision: str
    selected_oracle: OracleProvider
    confidence: float = Field(..., ge=0, le=1)
    alternative_considered: List[OracleProvider] = Field(default_factory=list)

class OracleDecisionContext(BaseModel):
    """Context for oracle decision making"""
    question_type: str
    data_requirements: Dict[str, Any]
    timing_constraints: Optional[str]
    accuracy_requirements: str
    cost_sensitivity: str
    chain_preferences: List[str]

# ============ ReAct Oracle Agent ============

class ReactOracleAgent:
    """
    Implements ReAct (Reasoning + Acting) pattern for oracle selection
    Uses chain-of-thought reasoning for complex decisions
    """
    
    def __init__(self, openrouter_api_key: str):
        self.api_key = openrouter_api_key
        self.base_url = "https://openrouter.ai/api/v1"
        self.model = "openai/gpt-4o-mini"
        
        # Define thinking prompts for different scenarios
        self.thinking_templates = {
            "analyze": "Let me analyze what type of data this question needs...",
            "consider": "I should consider the trade-offs between...",
            "evaluate": "Evaluating the requirements, I see that...",
            "decide": "Based on my analysis, the best choice is...",
            "verify": "Let me verify this decision makes sense..."
        }
    
    async def think_and_route(
        self,
        request: OracleRoutingRequest
    ) -> Tuple[OracleRoutingResponse, ReasoningChain]:
        """
        Use chain-of-thought reasoning to select the best oracle
        Returns both the routing response and the reasoning chain
        """
        
        # Step 1: Analyze the question
        context = await self._analyze_question_context(request.question)
        
        # Step 2: Generate reasoning chain
        reasoning_chain = await self._generate_reasoning_chain(request, context)
        
        # Step 3: Make final decision based on reasoning
        routing_response = await self._make_oracle_decision(request, reasoning_chain)
        
        return routing_response, reasoning_chain
    
    async def _analyze_question_context(self, question: str) -> OracleDecisionContext:
        """Analyze question to understand requirements"""
        
        prompt = f"""
        Analyze this prediction market question to understand its data requirements.
        
        Question: "{question}"
        
        Think step by step:
        1. What type of question is this? (price, sports, political, event, etc.)
        2. What specific data is needed to resolve it?
        3. How quickly does it need to be resolved?
        4. How accurate does the data need to be?
        5. Is cost a major factor?
        6. What blockchain networks might be involved?
        
        Respond with a JSON object matching this schema:
        {json.dumps(OracleDecisionContext.model_json_schema(), indent=2)}
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
                                "content": "You are an expert analyst. Break down questions systematically and identify all requirements."
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
                    data = json.loads(result["choices"][0]["message"]["content"])
                    return OracleDecisionContext.model_validate(data)
                    
        except Exception as e:
            logger.error(f"Context analysis failed: {e}")
            
        # Fallback context
        return OracleDecisionContext(
            question_type="unknown",
            data_requirements={},
            timing_constraints="standard",
            accuracy_requirements="high",
            cost_sensitivity="medium",
            chain_preferences=["ethereum", "polygon"]
        )
    
    async def _generate_reasoning_chain(
        self,
        request: OracleRoutingRequest,
        context: OracleDecisionContext
    ) -> ReasoningChain:
        """Generate chain-of-thought reasoning for oracle selection"""
        
        # Build the thinking prompt
        prompt = f"""
        I need to select the best oracle for this prediction market question.
        Use step-by-step reasoning to make the decision.
        
        Question: "{request.question}"
        
        Context:
        - Question Type: {context.question_type}
        - Data Requirements: {json.dumps(context.data_requirements)}
        - Timing: {context.timing_constraints}
        - Accuracy Needs: {context.accuracy_requirements}
        - Cost Sensitivity: {context.cost_sensitivity}
        
        Available Oracles with their strengths:
        1. CHAINLINK - Most reliable, wide coverage, sports partnerships, higher cost
        2. PYTH - Ultra-fast updates, great for crypto/stocks, lower cost
        3. UMA - Human verification, perfect for events/elections, slow but accurate
        4. BAND - Custom data, flexible, medium speed and cost
        5. API3 - Direct API access, first-party data, good for specific sources
        
        Think through this step by step:
        
        Step 1: Analyze what type of data is needed
        Step 2: Consider timing requirements
        Step 3: Evaluate accuracy vs speed trade-offs
        Step 4: Consider cost implications
        Step 5: Check chain compatibility
        Step 6: Make final recommendation with reasoning
        
        For each step, provide:
        - Thought: What you're considering
        - Observation: What you notice about the requirements
        - Action: What you'll check or evaluate
        - Result: What you concluded
        
        Respond with a JSON object matching this schema:
        {json.dumps(ReasoningChain.model_json_schema(), indent=2)}
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
                                "content": "You are an expert in blockchain oracles. Think step-by-step through complex decisions. Show your reasoning process clearly."
                            },
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.4,
                        "max_tokens": 1500,
                        "response_format": {"type": "json_object"}
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    data = json.loads(result["choices"][0]["message"]["content"])
                    return ReasoningChain.model_validate(data)
                    
        except Exception as e:
            logger.error(f"Reasoning chain generation failed: {e}")
        
        # Fallback reasoning
        return ReasoningChain(
            question=request.question,
            thoughts=[
                ThoughtStep(
                    step_number=1,
                    thought="Analyzing the question for data requirements",
                    observation="This appears to be a general prediction",
                    action="Selecting most versatile oracle",
                    result="UMA can handle custom events"
                )
            ],
            final_decision="Using UMA for maximum flexibility",
            selected_oracle=OracleProvider.UMA,
            confidence=0.6
        )
    
    async def _make_oracle_decision(
        self,
        request: OracleRoutingRequest,
        reasoning: ReasoningChain
    ) -> OracleRoutingResponse:
        """Convert reasoning chain into final routing decision"""
        
        # Extract key insights from reasoning
        oracle = reasoning.selected_oracle
        confidence = reasoning.confidence
        
        # Build oracle configuration based on selection
        oracle_config = self._build_oracle_config(oracle, request.question)
        
        # Estimate metrics
        cost, latency = self._estimate_metrics(oracle)
        
        # Format the reasoning into a clear explanation
        reasoning_text = self._format_reasoning(reasoning)
        
        return OracleRoutingResponse(
            can_resolve=True,
            selected_oracle=oracle,
            reasoning=reasoning_text,
            oracle_config=oracle_config,
            alternatives=reasoning.alternative_considered[:2] if reasoning.alternative_considered else None,
            data_type=self._infer_data_type(reasoning),
            required_feeds=[],
            estimated_cost_usd=cost,
            estimated_latency_ms=latency,
            confidence_score=confidence,
            resolution_method=self._get_resolution_method(oracle),
            update_frequency=self._get_update_frequency(oracle)
        )
    
    def _build_oracle_config(self, oracle: OracleProvider, question: str) -> Dict[str, Any]:
        """Build oracle-specific configuration"""
        
        configs = {
            OracleProvider.CHAINLINK: {
                "feed_type": "aggregated",
                "aggregation_method": "median",
                "node_count": 7
            },
            OracleProvider.PYTH: {
                "update_type": "pull",
                "confidence_interval": "95%",
                "max_staleness": 60
            },
            OracleProvider.UMA: {
                "identifier": "YES_OR_NO_QUERY",
                "bond_amount": "100",
                "liveness_period": 7200,
                "resolution_sources": ["Official sources", "News outlets"]
            },
            OracleProvider.BAND: {
                "request_type": "custom",
                "aggregation_count": 3,
                "min_consensus": 2
            },
            OracleProvider.API3: {
                "api_type": "first_party",
                "update_interval": 300,
                "signed_data": True
            }
        }
        
        return configs.get(oracle, {})
    
    def _estimate_metrics(self, oracle: OracleProvider) -> Tuple[Decimal, int]:
        """Estimate cost and latency for oracle"""
        
        metrics = {
            OracleProvider.CHAINLINK: (Decimal("0.50"), 500),
            OracleProvider.PYTH: (Decimal("0.10"), 100),
            OracleProvider.UMA: (Decimal("100.00"), 7200000),
            OracleProvider.BAND: (Decimal("0.30"), 1000),
            OracleProvider.API3: (Decimal("0.25"), 800)
        }
        
        return metrics.get(oracle, (Decimal("1.00"), 1000))
    
    def _format_reasoning(self, reasoning: ReasoningChain) -> str:
        """Format reasoning chain into readable explanation"""
        
        key_thoughts = [t for t in reasoning.thoughts if t.result]
        
        if key_thoughts:
            main_reason = key_thoughts[-1].result or reasoning.final_decision
        else:
            main_reason = reasoning.final_decision
        
        return f"{reasoning.selected_oracle.value} selected: {main_reason} (confidence: {reasoning.confidence:.0%})"
    
    def _infer_data_type(self, reasoning: ReasoningChain) -> DataCategory:
        """Infer data category from reasoning"""
        
        # Look for keywords in the reasoning
        reasoning_text = " ".join([t.thought + t.observation for t in reasoning.thoughts]).lower()
        
        if "price" in reasoning_text or "crypto" in reasoning_text:
            return DataCategory.PRICE
        elif "sport" in reasoning_text or "game" in reasoning_text:
            return DataCategory.SPORTS
        elif "election" in reasoning_text or "political" in reasoning_text:
            return DataCategory.ELECTION
        elif "event" in reasoning_text or "announce" in reasoning_text:
            return DataCategory.EVENTS
        else:
            return DataCategory.CUSTOM
    
    def _get_resolution_method(self, oracle: OracleProvider) -> str:
        """Get resolution method for oracle"""
        
        methods = {
            OracleProvider.UMA: "optimistic",
            OracleProvider.CHAINLINK: "aggregated",
            OracleProvider.PYTH: "direct",
            OracleProvider.BAND: "consensus",
            OracleProvider.API3: "signed"
        }
        
        return methods.get(oracle, "direct")
    
    def _get_update_frequency(self, oracle: OracleProvider) -> str:
        """Get update frequency for oracle"""
        
        from .schemas.oracle_schemas import UpdateFrequency
        
        frequencies = {
            OracleProvider.PYTH: UpdateFrequency.REALTIME,
            OracleProvider.CHAINLINK: UpdateFrequency.HIGH_FREQ,
            OracleProvider.UMA: UpdateFrequency.ON_DEMAND,
            OracleProvider.BAND: UpdateFrequency.MEDIUM_FREQ,
            OracleProvider.API3: UpdateFrequency.MEDIUM_FREQ
        }
        
        return frequencies.get(oracle, UpdateFrequency.LOW_FREQ)

# ============ Usage Example ============

async def demonstrate_thinking_oracle():
    """Demonstrate the thinking oracle agent"""
    
    agent = ReactOracleAgent(openrouter_api_key="your_key")
    
    # Test question
    request = OracleRoutingRequest(
        question="Will the Federal Reserve raise interest rates at the next FOMC meeting?"
    )
    
    # Get routing with reasoning
    response, reasoning = await agent.think_and_route(request)
    
    # Display the thinking process
    print("🧠 Chain of Thought Reasoning:")
    print("=" * 60)
    
    for thought in reasoning.thoughts:
        print(f"\nStep {thought.step_number}:")
        print(f"  💭 Thought: {thought.thought}")
        print(f"  👁️ Observation: {thought.observation}")
        print(f"  ⚡ Action: {thought.action}")
        if thought.result:
            print(f"  ✅ Result: {thought.result}")
    
    print(f"\n🎯 Final Decision: {reasoning.final_decision}")
    print(f"   Selected Oracle: {reasoning.selected_oracle.value}")
    print(f"   Confidence: {reasoning.confidence:.0%}")
    
    if reasoning.alternative_considered:
        print(f"   Alternatives Considered: {', '.join([o.value for o in reasoning.alternative_considered])}")
    
    print("\n" + "=" * 60)
    print(f"📊 Routing Response:")
    print(f"   Can Resolve: {response.can_resolve}")
    print(f"   Oracle: {response.selected_oracle.value}")
    print(f"   Reasoning: {response.reasoning}")
    print(f"   Estimated Cost: ${response.estimated_cost_usd}")
    print(f"   Estimated Latency: {response.estimated_latency_ms}ms")