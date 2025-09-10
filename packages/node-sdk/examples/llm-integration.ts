/**
 * Example: Using the unified LLM provider interface with OpenOracle Node SDK
 * 
 * This example demonstrates how to use multiple LLM providers (OpenAI, OpenRouter, WebLLM)
 * for prediction market data generation and oracle queries.
 */

import {
  // Core LLM providers
  LLMProvider,
  LLMRouter,
  ChatMessage,
  MessageRole,
  
  // Factory functions
  createOpenAIProvider,
  createOpenRouterProvider,
  createLLMRouter,
  
  // Convenience functions
  generateResponse,
  generateJsonResponse
} from '../src/ai/llm-providers'

/**
 * Basic usage of LLM providers
 */
async function exampleBasicUsage(): Promise<void> {
  console.log('=== Basic LLM Provider Usage ===')
  
  // Create router with available providers
  const router = createLLMRouter({
    openaiKey: process.env.OPENAI_API_KEY,
    openrouterKey: process.env.OPENROUTER_API_KEY
  })
  
  // Check available providers
  const available = await router.getAvailableProviders()
  console.log(`Available providers: ${available.map(p => p.toString())}`)
  
  // Generate a simple response
  const messages: ChatMessage[] = [
    {
      role: MessageRole.SYSTEM,
      content: 'You are a helpful assistant.'
    },
    {
      role: MessageRole.USER,
      content: 'Explain prediction markets in 2 sentences.'
    }
  ]
  
  const response = await generateResponse(messages, router, {
    temperature: 0.7
  })
  
  console.log(`\nResponse from ${response.provider}:`)
  console.log(`Model: ${response.model}`)
  console.log(`Content: ${response.content}`)
  console.log(`Usage: ${JSON.stringify(response.usage)}`)
}

/**
 * Generate prediction market data using LLM
 */
async function examplePredictionMarketGeneration(): Promise<void> {
  console.log('\n=== Prediction Market Generation ===')
  
  const router = createLLMRouter({
    openaiKey: process.env.OPENAI_API_KEY,
    openrouterKey: process.env.OPENROUTER_API_KEY
  })
  
  // Example news article
  const newsTitle = 'Tesla Stock Surges 15% After Q3 Earnings Beat'
  const newsContent = `
    Tesla reported stronger-than-expected earnings for Q3 2024, with revenue of $25.2B 
    beating analyst estimates of $24.8B. The company delivered 462,890 vehicles during 
    the quarter, up 6% from previous quarter. CEO Elon Musk announced plans for expanded 
    Cybertruck production and new Gigafactory locations. The stock jumped 15% in after-hours 
    trading following the earnings call.
  `
  
  // Generate poll question using JSON response
  const messages: ChatMessage[] = [
    {
      role: MessageRole.SYSTEM,
      content: `You are an expert at creating prediction market questions.
      Generate a specific, measurable poll question with clear resolution criteria.
      
      Respond with valid JSON:
      {
          "question": "poll question text",
          "options": ["option1", "option2", "option3"],
          "resolution_date": "YYYY-MM-DD",
          "category": "finance|tech|sports|politics",
          "confidence": 0.8
      }`
    },
    {
      role: MessageRole.USER,
      content: `Create a prediction market poll for this news:\n\nTitle: ${newsTitle}\n\nContent: ${newsContent}`
    }
  ]
  
  const result = await generateJsonResponse(messages, router, {
    temperature: 0.8
  })
  
  console.log('Generated Poll:')
  console.log(`Question: ${result.question}`)
  console.log(`Options: ${result.options}`)
  console.log(`Category: ${result.category}`)
  console.log(`Resolution Date: ${result.resolution_date}`)
}

/**
 * Demonstrate provider fallback and routing
 */
async function exampleMultiProviderFallback(): Promise<void> {
  console.log('\n=== Multi-Provider Fallback ===')
  
  const router = createLLMRouter({
    openaiKey: process.env.OPENAI_API_KEY,
    openrouterKey: process.env.OPENROUTER_API_KEY
  })
  
  const messages: ChatMessage[] = [
    {
      role: MessageRole.USER,
      content: 'What are the benefits of decentralized prediction markets?'
    }
  ]
  
  try {
    const response = await router.routeRequest(
      {
        messages,
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 200
      },
      LLMProvider.OPENAI, // Preferred provider
      true // Enable fallback
    )
    
    console.log(`Response from preferred provider (${response.provider}):`)
    console.log(`Content: ${response.content.substring(0, 200)}...`)
    console.log(`Response time: ${response.responseTimeMs}ms`)
    
  } catch (error) {
    console.log(`All providers failed: ${error}`)
  }
}

/**
 * Demonstrate streaming LLM responses
 */
async function exampleStreamingResponse(): Promise<void> {
  console.log('\n=== Streaming Response ===')
  
  const router = createLLMRouter({
    openaiKey: process.env.OPENAI_API_KEY,
    openrouterKey: process.env.OPENROUTER_API_KEY
  })
  
  const messages: ChatMessage[] = [
    {
      role: MessageRole.SYSTEM,
      content: 'You are explaining complex topics simply.'
    },
    {
      role: MessageRole.USER,
      content: 'Explain how oracle networks secure prediction markets. Write 3 paragraphs.'
    }
  ]
  
  console.log('Streaming response:')
  console.log('-'.repeat(40))
  
  try {
    for await (const chunk of router.streamRequest({
      messages,
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 400
    })) {
      process.stdout.write(chunk)
    }
  } catch (error) {
    console.log(`Streaming failed: ${error}`)
  }
  
  console.log('\n' + '-'.repeat(40))
}

/**
 * Demonstrate cost estimation for different providers
 */
async function exampleCostEstimation(): Promise<void> {
  console.log('\n=== Cost Estimation ===')
  
  try {
    // Create individual providers
    const openaiProvider = createOpenAIProvider(process.env.OPENAI_API_KEY || '')
    const openrouterProvider = createOpenRouterProvider(process.env.OPENROUTER_API_KEY || '')
    
    const messages: ChatMessage[] = [
      {
        role: MessageRole.USER,
        content: 'Generate 5 prediction market questions about the upcoming election.'
      }
    ]
    
    const request = {
      messages,
      model: 'gpt-4o-mini',
      temperature: 0.8,
      maxTokens: 1000
    }
    
    // Estimate costs
    const openaiCost = openaiProvider.estimateCost(request)
    const openrouterCost = openrouterProvider.estimateCost(request)
    
    console.log('Cost estimates for request:')
    console.log(`OpenAI: ${openaiCost ? `$${openaiCost.toFixed(4)}` : 'Cost unavailable'}`)
    console.log(`OpenRouter: ${openrouterCost ? `$${openrouterCost.toFixed(4)}` : 'Cost unavailable'}`)
    
    // Show supported models
    console.log('\nSupported models:')
    console.log(`OpenAI: ${openaiProvider.getSupportedModels()}`)
    console.log(`OpenRouter: ${openrouterProvider.getSupportedModels().slice(0, 5)}...`) // Show first 5
    
  } catch (error) {
    console.log(`Cost estimation failed: ${error}`)
  }
}

/**
 * Example of using WebLLM provider (browser only)
 */
async function exampleWebLLMUsage(): Promise<void> {
  console.log('\n=== WebLLM Usage (Browser Only) ===')
  
  // Note: WebLLM only works in browser environments
  // This is just to show the API
  
  try {
    const router = createLLMRouter({
      enableWebllm: true
    })
    
    const available = await router.getAvailableProviders()
    
    if (available.includes(LLMProvider.WEBLLM)) {
      console.log('✅ WebLLM is available (browser environment)')
      
      const messages: ChatMessage[] = [
        {
          role: MessageRole.USER,
          content: 'Hello from WebLLM!'
        }
      ]
      
      const response = await generateResponse(messages, router, {
        preferredProvider: LLMProvider.WEBLLM
      })
      
      console.log(`WebLLM response: ${response.content}`)
    } else {
      console.log('⚠️  WebLLM not available (requires browser environment)')
    }
    
  } catch (error) {
    console.log(`WebLLM example failed: ${error}`)
  }
}

/**
 * Run all examples
 */
async function main(): Promise<void> {
  console.log('OpenOracle Node SDK - LLM Integration Examples')
  console.log('='.repeat(50))
  
  // Check for required API keys
  if (!process.env.OPENAI_API_KEY && !process.env.OPENROUTER_API_KEY) {
    console.log('⚠️  Please set OPENAI_API_KEY or OPENROUTER_API_KEY environment variables')
    return
  }
  
  try {
    await exampleBasicUsage()
    await examplePredictionMarketGeneration()
    await exampleMultiProviderFallback()
    await exampleStreamingResponse()
    await exampleCostEstimation()
    await exampleWebLLMUsage()
    
  } catch (error) {
    console.log(`❌ Example failed: ${error}`)
    console.error(error)
  }
  
  console.log('\n✅ All examples completed!')
}

// Run examples if called directly
if (require.main === module) {
  main().catch(console.error)
}

export {
  exampleBasicUsage,
  examplePredictionMarketGeneration,
  exampleMultiProviderFallback,
  exampleStreamingResponse,
  exampleCostEstimation,
  exampleWebLLMUsage
}