"""
Unified LLM Provider Interface for OpenOracle SDK

Provides a consistent interface for interacting with different LLM providers:
- OpenAI (GPT-4, GPT-3.5-turbo, etc.)
- OpenRouter (Multiple models via single API)
- WebLLM (Local browser-based models)
- Anthropic Claude (via OpenRouter)

This module enables dynamic routing between providers based on availability,
cost, performance, and specific use case requirements.
"""

from __future__ import annotations

import json
import asyncio
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Union, Callable, AsyncGenerator
from dataclasses import dataclass, field
from enum import Enum
import time
import logging

import aiohttp
from pydantic import BaseModel, Field, ConfigDict, ValidationError

logger = logging.getLogger(__name__)


# ============ Core Models ============

class LLMProvider(str, Enum):
    """Supported LLM providers"""
    OPENAI = "openai"
    OPENROUTER = "openrouter" 
    WEBLLM = "webllm"
    ANTHROPIC = "anthropic"


class MessageRole(str, Enum):
    """Chat message roles"""
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"


@dataclass
class ChatMessage:
    """Single chat message"""
    role: MessageRole
    content: str
    name: Optional[str] = None


@dataclass  
class TokenUsage:
    """Token usage statistics"""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cost_usd: Optional[float] = None


@dataclass
class LLMResponse:
    """Response from LLM provider"""
    content: str
    model: str
    provider: LLMProvider
    usage: Optional[TokenUsage] = None
    response_time_ms: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class LLMRequest(BaseModel):
    """Request to LLM provider"""
    model_config = ConfigDict(arbitrary_types_allowed=True)
    
    messages: List[ChatMessage]
    model: str
    temperature: float = 0.8
    max_tokens: int = 800
    response_format: Optional[Dict[str, str]] = None
    tools: Optional[List[Dict[str, Any]]] = None
    stream: bool = False
    
    # Provider-specific options
    top_p: Optional[float] = None
    frequency_penalty: Optional[float] = None
    presence_penalty: Optional[float] = None
    stop: Optional[List[str]] = None


# ============ Base Provider Interface ============

class BaseLLMProvider(ABC):
    """Abstract base class for all LLM providers"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.provider = self.get_provider()
        
    @abstractmethod
    def get_provider(self) -> LLMProvider:
        """Return the provider type"""
        pass
        
    @abstractmethod
    async def is_available(self) -> bool:
        """Check if provider is available and configured"""
        pass
    
    @abstractmethod
    async def generate(self, request: LLMRequest) -> LLMResponse:
        """Generate response from LLM"""
        pass
        
    @abstractmethod  
    async def stream_generate(self, request: LLMRequest) -> AsyncGenerator[str, None]:
        """Stream response from LLM"""
        pass
        
    @abstractmethod
    def get_supported_models(self) -> List[str]:
        """Get list of supported model names"""
        pass
        
    @abstractmethod
    def estimate_cost(self, request: LLMRequest) -> Optional[float]:
        """Estimate cost in USD for the request"""
        pass


# ============ OpenAI Provider ============

class OpenAIProvider(BaseLLMProvider):
    """OpenAI GPT provider"""
    
    MODELS = {
        "gpt-4o": {"input": 0.005, "output": 0.015},
        "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
        "gpt-4-turbo": {"input": 0.01, "output": 0.03},
        "gpt-3.5-turbo": {"input": 0.001, "output": 0.002},
    }
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.api_key = config.get("api_key")
        self.base_url = config.get("base_url", "https://api.openai.com/v1")
        self.default_model = config.get("default_model", "gpt-4o-mini")
        
        if not self.api_key:
            raise ValueError("OpenAI API key is required")
    
    def get_provider(self) -> LLMProvider:
        return LLMProvider.OPENAI
        
    async def is_available(self) -> bool:
        """Test OpenAI API availability"""
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/models",
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as response:
                    return response.status == 200
        except Exception as e:
            logger.warning(f"OpenAI availability check failed: {e}")
            return False
    
    async def generate(self, request: LLMRequest) -> LLMResponse:
        """Generate response via OpenAI API"""
        start_time = time.time()
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            # Convert messages to OpenAI format
            messages = [
                {"role": msg.role.value, "content": msg.content} 
                for msg in request.messages
            ]
            
            payload = {
                "model": request.model or self.default_model,
                "messages": messages,
                "temperature": request.temperature,
                "max_tokens": request.max_tokens,
            }
            
            # Add optional parameters
            if request.response_format:
                payload["response_format"] = request.response_format
            if request.top_p is not None:
                payload["top_p"] = request.top_p
            if request.frequency_penalty is not None:
                payload["frequency_penalty"] = request.frequency_penalty
            if request.presence_penalty is not None:
                payload["presence_penalty"] = request.presence_penalty
            if request.stop:
                payload["stop"] = request.stop
                
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=60)
                ) as response:
                    
                    if response.status != 200:
                        error_data = await response.json()
                        raise Exception(f"OpenAI API error: {error_data}")
                    
                    data = await response.json()
                    
            choice = data["choices"][0]
            usage_data = data.get("usage", {})
            
            # Calculate cost
            model_name = data["model"]
            cost = None
            if model_name in self.MODELS and usage_data:
                pricing = self.MODELS[model_name]
                prompt_cost = usage_data.get("prompt_tokens", 0) * pricing["input"] / 1000
                completion_cost = usage_data.get("completion_tokens", 0) * pricing["output"] / 1000
                cost = prompt_cost + completion_cost
            
            usage = TokenUsage(
                prompt_tokens=usage_data.get("prompt_tokens", 0),
                completion_tokens=usage_data.get("completion_tokens", 0),
                total_tokens=usage_data.get("total_tokens", 0),
                cost_usd=cost
            )
            
            return LLMResponse(
                content=choice["message"]["content"],
                model=data["model"],
                provider=self.provider,
                usage=usage,
                response_time_ms=int((time.time() - start_time) * 1000)
            )
            
        except Exception as e:
            logger.error(f"OpenAI generation failed: {e}")
            raise
    
    async def stream_generate(self, request: LLMRequest) -> AsyncGenerator[str, None]:
        """Stream response from OpenAI"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        messages = [
            {"role": msg.role.value, "content": msg.content} 
            for msg in request.messages
        ]
        
        payload = {
            "model": request.model or self.default_model,
            "messages": messages,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "stream": True
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=120)
            ) as response:
                
                async for line in response.content:
                    line = line.decode('utf-8').strip()
                    
                    if line.startswith("data: "):
                        line = line[6:]
                        
                        if line == "[DONE]":
                            break
                            
                        try:
                            chunk = json.loads(line)
                            delta = chunk["choices"][0]["delta"]
                            
                            if "content" in delta:
                                yield delta["content"]
                                
                        except (json.JSONDecodeError, KeyError):
                            continue
    
    def get_supported_models(self) -> List[str]:
        return list(self.MODELS.keys())
    
    def estimate_cost(self, request: LLMRequest) -> Optional[float]:
        model = request.model or self.default_model
        if model not in self.MODELS:
            return None
            
        pricing = self.MODELS[model]
        
        # Estimate tokens (rough approximation: 4 chars = 1 token)
        total_chars = sum(len(msg.content) for msg in request.messages)
        prompt_tokens = total_chars // 4
        completion_tokens = request.max_tokens
        
        prompt_cost = prompt_tokens * pricing["input"] / 1000
        completion_cost = completion_tokens * pricing["output"] / 1000
        
        return prompt_cost + completion_cost


# ============ OpenRouter Provider ============

class OpenRouterProvider(BaseLLMProvider):
    """OpenRouter multi-model provider"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.api_key = config.get("api_key")
        self.base_url = config.get("base_url", "https://openrouter.ai/api/v1")
        self.default_model = config.get("default_model", "openai/gpt-4o-mini")
        self.http_referer = config.get("http_referer", "https://polypoll.app")
        self.x_title = config.get("x_title", "PolyPoll - Viral Prediction Markets")
        
        if not self.api_key:
            raise ValueError("OpenRouter API key is required")
    
    def get_provider(self) -> LLMProvider:
        return LLMProvider.OPENROUTER
        
    async def is_available(self) -> bool:
        """Test OpenRouter API availability"""
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": self.http_referer,
                "X-Title": self.x_title
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/models",
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as response:
                    return response.status == 200
        except Exception as e:
            logger.warning(f"OpenRouter availability check failed: {e}")
            return False
    
    async def generate(self, request: LLMRequest) -> LLMResponse:
        """Generate response via OpenRouter API"""
        start_time = time.time()
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": self.http_referer,
                "X-Title": self.x_title
            }
            
            # Convert messages to OpenRouter format
            messages = [
                {"role": msg.role.value, "content": msg.content} 
                for msg in request.messages
            ]
            
            payload = {
                "model": request.model or self.default_model,
                "messages": messages,
                "temperature": request.temperature,
                "max_tokens": request.max_tokens,
            }
            
            # Add optional parameters
            if request.response_format:
                payload["response_format"] = request.response_format
            if request.top_p is not None:
                payload["top_p"] = request.top_p
            if request.frequency_penalty is not None:
                payload["frequency_penalty"] = request.frequency_penalty
            if request.presence_penalty is not None:
                payload["presence_penalty"] = request.presence_penalty
            if request.stop:
                payload["stop"] = request.stop
                
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=60)
                ) as response:
                    
                    if response.status != 200:
                        error_data = await response.json()
                        raise Exception(f"OpenRouter API error: {error_data}")
                    
                    data = await response.json()
                    
            choice = data["choices"][0]
            usage_data = data.get("usage", {})
            
            usage = TokenUsage(
                prompt_tokens=usage_data.get("prompt_tokens", 0),
                completion_tokens=usage_data.get("completion_tokens", 0),
                total_tokens=usage_data.get("total_tokens", 0),
                # OpenRouter doesn't provide cost in response
                cost_usd=None
            )
            
            return LLMResponse(
                content=choice["message"]["content"],
                model=data["model"],
                provider=self.provider,
                usage=usage,
                response_time_ms=int((time.time() - start_time) * 1000)
            )
            
        except Exception as e:
            logger.error(f"OpenRouter generation failed: {e}")
            raise
    
    async def stream_generate(self, request: LLMRequest) -> AsyncGenerator[str, None]:
        """Stream response from OpenRouter"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": self.http_referer,
            "X-Title": self.x_title
        }
        
        messages = [
            {"role": msg.role.value, "content": msg.content} 
            for msg in request.messages
        ]
        
        payload = {
            "model": request.model or self.default_model,
            "messages": messages,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "stream": True
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=120)
            ) as response:
                
                async for line in response.content:
                    line = line.decode('utf-8').strip()
                    
                    if line.startswith("data: "):
                        line = line[6:]
                        
                        if line == "[DONE]":
                            break
                            
                        try:
                            chunk = json.loads(line)
                            delta = chunk["choices"][0]["delta"]
                            
                            if "content" in delta:
                                yield delta["content"]
                                
                        except (json.JSONDecodeError, KeyError):
                            continue
    
    def get_supported_models(self) -> List[str]:
        # Common OpenRouter models - this could be dynamically fetched
        return [
            "openai/gpt-4o",
            "openai/gpt-4o-mini", 
            "openai/gpt-4-turbo",
            "anthropic/claude-3.5-sonnet",
            "anthropic/claude-3-haiku",
            "meta-llama/llama-3.1-405b-instruct",
            "meta-llama/llama-3.1-70b-instruct",
            "meta-llama/llama-3.1-8b-instruct",
            "google/gemini-pro-1.5",
            "cohere/command-r-plus",
            "mistralai/mistral-7b-instruct",
            "qwen/qwen-2-7b-instruct"
        ]
    
    def estimate_cost(self, request: LLMRequest) -> Optional[float]:
        # OpenRouter pricing varies by model - would need to fetch from API
        return None


# ============ WebLLM Provider ============

class WebLLMProvider(BaseLLMProvider):
    """WebLLM browser-based local provider (for client-side usage)"""
    
    SUPPORTED_MODELS = [
        "Llama-3.2-3B-Instruct-q4f32_1",
        "Llama-3.2-1B-Instruct-q4f32_1", 
        "Llama-3.1-8B-Instruct-q4f32_1",
        "Phi-3.5-mini-instruct-q4f16_1",
        "TinyLlama-1.1B-Chat-v1.0-q4f16_1",
        "SmolLM2-1.7B-Instruct-q4f16_1",
        "Qwen2.5-3B-Instruct-q4f16_1"
    ]
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.default_model = config.get("default_model", "Llama-3.2-1B-Instruct-q4f32_1")
        # WebLLM runs in browser, so no API key needed
    
    def get_provider(self) -> LLMProvider:
        return LLMProvider.WEBLLM
        
    async def is_available(self) -> bool:
        """WebLLM availability depends on browser WebGPU support"""
        # This would need to be implemented on client-side
        # For server-side, we assume it's not available
        return False
    
    async def generate(self, request: LLMRequest) -> LLMResponse:
        """Generate response via WebLLM (client-side only)"""
        raise NotImplementedError("WebLLM only works in browser environment")
    
    async def stream_generate(self, request: LLMRequest) -> AsyncGenerator[str, None]:
        """Stream response from WebLLM (client-side only)"""
        raise NotImplementedError("WebLLM only works in browser environment")
        yield  # Make it a generator
    
    def get_supported_models(self) -> List[str]:
        return self.SUPPORTED_MODELS.copy()
    
    def estimate_cost(self, request: LLMRequest) -> Optional[float]:
        # WebLLM is free (local compute)
        return 0.0


# ============ LLM Router ============

@dataclass
class ProviderConfig:
    """Configuration for a specific provider"""
    provider: LLMProvider
    config: Dict[str, Any]
    priority: int = 1  # Higher = preferred
    max_tokens: Optional[int] = None
    enabled: bool = True


class LLMRouter:
    """Intelligent router for LLM providers"""
    
    def __init__(self, providers: List[ProviderConfig]):
        self.providers = {}
        self.provider_configs = providers
        
        # Initialize providers
        for provider_config in providers:
            if not provider_config.enabled:
                continue
                
            provider_cls = self._get_provider_class(provider_config.provider)
            try:
                provider = provider_cls(provider_config.config)
                self.providers[provider_config.provider] = provider
                logger.info(f"Initialized {provider_config.provider.value} provider")
            except Exception as e:
                logger.error(f"Failed to initialize {provider_config.provider.value}: {e}")
    
    def _get_provider_class(self, provider: LLMProvider) -> type[BaseLLMProvider]:
        """Get provider class by type"""
        mapping = {
            LLMProvider.OPENAI: OpenAIProvider,
            LLMProvider.OPENROUTER: OpenRouterProvider, 
            LLMProvider.WEBLLM: WebLLMProvider,
        }
        
        if provider not in mapping:
            raise ValueError(f"Unsupported provider: {provider}")
            
        return mapping[provider]
    
    async def get_available_providers(self) -> List[LLMProvider]:
        """Get list of currently available providers"""
        available = []
        
        for provider_type, provider in self.providers.items():
            try:
                if await provider.is_available():
                    available.append(provider_type)
            except Exception as e:
                logger.warning(f"Availability check failed for {provider_type}: {e}")
        
        return available
    
    async def route_request(
        self,
        request: LLMRequest,
        preferred_provider: Optional[LLMProvider] = None,
        fallback: bool = True
    ) -> LLMResponse:
        """Route request to best available provider"""
        
        # Try preferred provider first
        if preferred_provider and preferred_provider in self.providers:
            try:
                provider = self.providers[preferred_provider]
                if await provider.is_available():
                    logger.info(f"Using preferred provider: {preferred_provider.value}")
                    return await provider.generate(request)
            except Exception as e:
                logger.warning(f"Preferred provider {preferred_provider.value} failed: {e}")
                if not fallback:
                    raise
        
        # Try providers by priority
        available_providers = await self.get_available_providers()
        
        if not available_providers:
            raise Exception("No LLM providers are currently available")
        
        # Sort by priority from config
        provider_priorities = {
            pc.provider: pc.priority 
            for pc in self.provider_configs 
            if pc.enabled
        }
        
        sorted_providers = sorted(
            available_providers,
            key=lambda p: provider_priorities.get(p, 0),
            reverse=True
        )
        
        last_error = None
        for provider_type in sorted_providers:
            try:
                provider = self.providers[provider_type]
                logger.info(f"Trying provider: {provider_type.value}")
                return await provider.generate(request)
                
            except Exception as e:
                logger.warning(f"Provider {provider_type.value} failed: {e}")
                last_error = e
                continue
        
        # All providers failed
        raise Exception(f"All providers failed. Last error: {last_error}")
    
    async def stream_request(
        self,
        request: LLMRequest,
        preferred_provider: Optional[LLMProvider] = None
    ) -> AsyncGenerator[str, None]:
        """Stream response from provider"""
        
        # Select provider (similar logic to route_request)
        provider = None
        
        if preferred_provider and preferred_provider in self.providers:
            try:
                candidate = self.providers[preferred_provider]
                if await candidate.is_available():
                    provider = candidate
            except Exception:
                pass
        
        if not provider:
            available = await self.get_available_providers()
            if available:
                provider = self.providers[available[0]]
        
        if not provider:
            raise Exception("No providers available for streaming")
        
        async for chunk in provider.stream_generate(request):
            yield chunk
    
    def get_provider(self, provider_type: LLMProvider) -> Optional[BaseLLMProvider]:
        """Get specific provider instance"""
        return self.providers.get(provider_type)
    
    def get_supported_models(self, provider_type: Optional[LLMProvider] = None) -> Dict[LLMProvider, List[str]]:
        """Get supported models by provider"""
        if provider_type:
            provider = self.providers.get(provider_type)
            if provider:
                return {provider_type: provider.get_supported_models()}
            return {}
        
        return {
            ptype: provider.get_supported_models()
            for ptype, provider in self.providers.items()
        }


# ============ Factory Functions ============

def create_openai_provider(api_key: str, **kwargs) -> OpenAIProvider:
    """Create OpenAI provider with API key"""
    config = {"api_key": api_key, **kwargs}
    return OpenAIProvider(config)


def create_openrouter_provider(api_key: str, **kwargs) -> OpenRouterProvider:
    """Create OpenRouter provider with API key"""
    config = {"api_key": api_key, **kwargs}
    return OpenRouterProvider(config)


def create_webllm_provider(**kwargs) -> WebLLMProvider:
    """Create WebLLM provider (client-side only)"""
    return WebLLMProvider(kwargs)


def create_llm_router(
    openai_key: Optional[str] = None,
    openrouter_key: Optional[str] = None,
    enable_webllm: bool = False
) -> LLMRouter:
    """Create LLM router with common configuration"""
    
    providers = []
    
    # Add OpenAI if key provided
    if openai_key:
        providers.append(ProviderConfig(
            provider=LLMProvider.OPENAI,
            config={"api_key": openai_key},
            priority=3,  # High priority
            enabled=True
        ))
    
    # Add OpenRouter if key provided
    if openrouter_key:
        providers.append(ProviderConfig(
            provider=LLMProvider.OPENROUTER,
            config={"api_key": openrouter_key},
            priority=2,  # Medium priority
            enabled=True
        ))
    
    # Add WebLLM if enabled (client-side only)
    if enable_webllm:
        providers.append(ProviderConfig(
            provider=LLMProvider.WEBLLM,
            config={},
            priority=1,  # Low priority (slower)
            enabled=True
        ))
    
    if not providers:
        raise ValueError("At least one provider must be configured")
    
    return LLMRouter(providers)


# ============ Convenience Functions ============

async def generate_response(
    messages: List[ChatMessage],
    router: LLMRouter,
    model: str = "gpt-4o-mini",
    temperature: float = 0.8,
    max_tokens: int = 800,
    response_format: Optional[Dict[str, str]] = None,
    preferred_provider: Optional[LLMProvider] = None
) -> LLMResponse:
    """Generate response using router"""
    
    request = LLMRequest(
        messages=messages,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        response_format=response_format
    )
    
    return await router.route_request(request, preferred_provider)


async def generate_json_response(
    messages: List[ChatMessage],
    router: LLMRouter,
    model: str = "gpt-4o-mini",
    temperature: float = 0.8,
    max_tokens: int = 800,
    preferred_provider: Optional[LLMProvider] = None
) -> Dict[str, Any]:
    """Generate JSON response using router"""
    
    # Add JSON instruction to last user message
    if messages and messages[-1].role == MessageRole.USER:
        messages[-1].content += "\n\nRespond with valid JSON only."
    
    request = LLMRequest(
        messages=messages,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        response_format={"type": "json_object"}
    )
    
    response = await router.route_request(request, preferred_provider)
    
    try:
        return json.loads(response.content)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON response: {response.content}")
        raise ValueError(f"Invalid JSON response: {e}")