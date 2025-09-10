"""
Example: Using the unified LLM provider interface with OpenOracle SDK

This example demonstrates how to use multiple LLM providers (OpenAI, OpenRouter, WebLLM)
for prediction market data generation and oracle queries.
"""

import asyncio
import os
from openoracle import (
    # Core LLM providers
    LLMProvider,
    LLMRouter,
    ChatMessage,
    MessageRole,
    
    # Factory functions
    create_openai_provider,
    create_openrouter_provider, 
    create_llm_router,
    
    # Convenience functions
    generate_response,
    generate_json_response
)


async def example_basic_usage():
    """Basic usage of LLM providers"""
    print("=== Basic LLM Provider Usage ===")
    
    # Create router with available providers
    router = create_llm_router(
        openai_key=os.getenv("OPENAI_API_KEY"),
        openrouter_key=os.getenv("OPENROUTER_API_KEY")
    )
    
    # Check available providers
    available = await router.get_available_providers()
    print(f"Available providers: {[p.value for p in available]}")
    
    # Generate a simple response
    messages = [
        ChatMessage(
            role=MessageRole.SYSTEM,
            content="You are a helpful assistant."
        ),
        ChatMessage(
            role=MessageRole.USER,
            content="Explain prediction markets in 2 sentences."
        )
    ]
    
    response = await generate_response(
        messages=messages,
        router=router,
        temperature=0.7
    )
    
    print(f"\nResponse from {response.provider.value}:")
    print(f"Model: {response.model}")
    print(f"Content: {response.content}")
    print(f"Usage: {response.usage}")


async def example_prediction_market_generation():
    """Generate prediction market data using LLM"""
    print("\n=== Prediction Market Generation ===")
    
    router = create_llm_router(
        openai_key=os.getenv("OPENAI_API_KEY"),
        openrouter_key=os.getenv("OPENROUTER_API_KEY")
    )
    
    # Example news article
    news_title = "Tesla Stock Surges 15% After Q3 Earnings Beat"
    news_content = """
    Tesla reported stronger-than-expected earnings for Q3 2024, with revenue of $25.2B 
    beating analyst estimates of $24.8B. The company delivered 462,890 vehicles during 
    the quarter, up 6% from previous quarter. CEO Elon Musk announced plans for expanded 
    Cybertruck production and new Gigafactory locations. The stock jumped 15% in after-hours 
    trading following the earnings call.
    """
    
    # Generate poll question using JSON response
    messages = [
        ChatMessage(
            role=MessageRole.SYSTEM,
            content="""You are an expert at creating prediction market questions.
            Generate a specific, measurable poll question with clear resolution criteria.
            
            Respond with valid JSON:
            {
                "question": "poll question text",
                "options": ["option1", "option2", "option3"],
                "resolution_date": "YYYY-MM-DD",
                "category": "finance|tech|sports|politics",
                "confidence": 0.8
            }"""
        ),
        ChatMessage(
            role=MessageRole.USER,
            content=f"Create a prediction market poll for this news:\n\nTitle: {news_title}\n\nContent: {news_content}"
        )
    ]
    
    result = await generate_json_response(
        messages=messages,
        router=router,
        temperature=0.8
    )
    
    print(f"Generated Poll:")
    print(f"Question: {result['question']}")
    print(f"Options: {result['options']}")
    print(f"Category: {result['category']}")
    print(f"Resolution Date: {result['resolution_date']}")


async def example_multi_provider_fallback():
    """Demonstrate provider fallback and routing"""
    print("\n=== Multi-Provider Fallback ===")
    
    router = create_llm_router(
        openai_key=os.getenv("OPENAI_API_KEY"),
        openrouter_key=os.getenv("OPENROUTER_API_KEY")
    )
    
    messages = [
        ChatMessage(
            role=MessageRole.USER,
            content="What are the benefits of decentralized prediction markets?"
        )
    ]
    
    # Try specific provider first
    try:
        response = await router.route_request(
            request={
                "messages": messages,
                "model": "gpt-4o-mini",
                "temperature": 0.7,
                "max_tokens": 200
            },
            preferred_provider=LLMProvider.OPENAI,
            fallback=True
        )
        
        print(f"Response from preferred provider ({response.provider.value}):")
        print(f"Content: {response.content[:200]}...")
        print(f"Response time: {response.response_time_ms}ms")
        
    except Exception as e:
        print(f"All providers failed: {e}")


async def example_streaming_response():
    """Demonstrate streaming LLM responses"""
    print("\n=== Streaming Response ===")
    
    router = create_llm_router(
        openai_key=os.getenv("OPENAI_API_KEY"),
        openrouter_key=os.getenv("OPENROUTER_API_KEY")
    )
    
    messages = [
        ChatMessage(
            role=MessageRole.SYSTEM,
            content="You are explaining complex topics simply."
        ),
        ChatMessage(
            role=MessageRole.USER,
            content="Explain how oracle networks secure prediction markets. Write 3 paragraphs."
        )
    ]
    
    print("Streaming response:")
    print("-" * 40)
    
    async for chunk in router.stream_request(
        request={
            "messages": messages,
            "model": "gpt-4o-mini",
            "temperature": 0.7,
            "max_tokens": 400
        }
    ):
        print(chunk, end='', flush=True)
    
    print("\n" + "-" * 40)


async def example_cost_estimation():
    """Demonstrate cost estimation for different providers"""
    print("\n=== Cost Estimation ===")
    
    # Create individual providers
    try:
        openai_provider = create_openai_provider(os.getenv("OPENAI_API_KEY"))
        openrouter_provider = create_openrouter_provider(os.getenv("OPENROUTER_API_KEY"))
        
        messages = [
            ChatMessage(
                role=MessageRole.USER,
                content="Generate 5 prediction market questions about the upcoming election."
            )
        ]
        
        request = {
            "messages": messages,
            "model": "gpt-4o-mini",
            "temperature": 0.8,
            "max_tokens": 1000
        }
        
        # Estimate costs
        openai_cost = openai_provider.estimate_cost(request)
        openrouter_cost = openrouter_provider.estimate_cost(request)
        
        print(f"Cost estimates for request:")
        print(f"OpenAI: ${openai_cost:.4f}" if openai_cost else "OpenAI: Cost unavailable")
        print(f"OpenRouter: ${openrouter_cost:.4f}" if openrouter_cost else "OpenRouter: Cost unavailable")
        
        # Show supported models
        print(f"\nSupported models:")
        print(f"OpenAI: {openai_provider.get_supported_models()}")
        print(f"OpenRouter: {openrouter_provider.get_supported_models()[:5]}...")  # Show first 5
        
    except Exception as e:
        print(f"Cost estimation failed: {e}")


async def main():
    """Run all examples"""
    print("OpenOracle SDK - LLM Integration Examples")
    print("=" * 50)
    
    # Check for required API keys
    if not os.getenv("OPENAI_API_KEY") and not os.getenv("OPENROUTER_API_KEY"):
        print("⚠️  Please set OPENAI_API_KEY or OPENROUTER_API_KEY environment variables")
        return
    
    try:
        await example_basic_usage()
        await example_prediction_market_generation()
        await example_multi_provider_fallback()
        await example_streaming_response()
        await example_cost_estimation()
        
    except Exception as e:
        print(f"❌ Example failed: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n✅ All examples completed!")


if __name__ == "__main__":
    asyncio.run(main())