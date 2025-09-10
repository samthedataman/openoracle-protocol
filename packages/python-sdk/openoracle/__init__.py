"""
OpenOracle SDK - Intelligent Oracle Routing for Prediction Markets

A comprehensive Python SDK for building prediction markets with intelligent
oracle selection and data verification.

Key Components:
- OracleRouter: Intelligent routing to optimal oracle providers
- TwitterParser: Social media integration and analysis
- ReActAgent: AI-driven decision making with explainable reasoning
- MultiOracleAggregator: Consensus mechanisms across oracle networks
- SchemaValidator: Type-safe data validation

Example:
    >>> from openoracle import OracleRouter, TwitterParser
    >>> from openoracle.config import OracleConfig
    >>> 
    >>> # Initialize the router with API keys
    >>> config = OracleConfig.from_env()
    >>> router = OracleRouter(config)
    >>> 
    >>> # Route a question to the best oracle
    >>> response = await router.route_question(
    ...     "Will BTC exceed $100k by end of 2024?"
    ... )
    >>> print(f"Selected: {response.oracle_provider}")
    >>> print(f"Confidence: {response.confidence}")
    >>> 
    >>> # Parse Twitter content for prediction markets
    >>> twitter = TwitterParser(config)
    >>> prediction = await twitter.create_prediction_from_tweet(tweet_data)
"""

from __future__ import annotations

__version__ = "0.1.0"
__author__ = "OpenOracle Team"
__license__ = "MIT"
__description__ = "Intelligent Oracle Routing for Prediction Markets"

# Core classes - main public API
from .core.router import OpenOracleRouter
from .core.config import OracleConfig, get_config, set_config
from .core.client import OpenOracleClient
from .core.exceptions import (
    OracleError,
    RoutingError,
    ValidationError,
    ConfigurationError,
    ProviderError,
    NetworkError,
    AuthenticationError,
    RateLimitError,
    TimeoutError,
    DataIntegrityError,
    UnsupportedOperationError
)

# API clients
from .api.client import OpenOracleAPI
from .api.oracle_api import OracleAPI
from .api.twitter_api import TwitterAPI
from .api.poll_api import PollAPI

# Pure AI routing
from .ai.pure_ai_router import PureAIRouter, PureAgentRouter

# LLM Providers
from .ai.llm_providers import (
    LLMProvider,
    LLMRouter,
    BaseLLMProvider,
    OpenAIProvider,
    OpenRouterProvider,
    WebLLMProvider,
    ChatMessage,
    MessageRole,
    LLMRequest,
    LLMResponse,
    TokenUsage,
    ProviderConfig,
    create_openai_provider,
    create_openrouter_provider,
    create_webllm_provider,
    create_llm_router,
    generate_response,
    generate_json_response
)

# Schema validation and models
from .schemas.oracle_schemas import (
    OracleProvider,
    DataCategory,
    UpdateFrequency,
    OracleRoutingRequest,
    OracleRoutingResponse,
    OracleDataPoint,
    OraclePollData,
    AggregatedOracleData,
    ChainlinkPriceFeed,
    PythPriceFeed,
    OracleCapability
)

# Oracle providers
from .providers.base import BaseOracleProvider
from .providers.chainlink import ChainlinkProvider
from .providers.pyth import PythProvider
from .providers.uma import UMAProvider
from .providers.band import BandProvider
from .providers.api3 import API3Provider

# Enums and constants
from .schemas.enums import (
    OracleProvider,
    DataCategory,
    UpdateFrequency,
    ResolutionMethod
)

# Utilities
from .utils.logger import get_logger
from .utils.async_helpers import (
    run_async,
    gather_with_timeout,
    retry_async
)
from .utils.retry import (
    RetryConfig,
    async_retry,
    sync_retry,
    retry_decorator,
    CircuitBreaker,
    RateLimiter,
    network_retry,
    provider_retry,
    api_retry
)
from .utils.cache import (
    CacheManager,
    MemoryCache,
    FileCache,
    create_cache,
    cache_key_from_request,
    ttl_from_category
)

# Make commonly used items available at package level
__all__ = [
    # Core classes
    "OpenOracleAPI",
    "OpenOracleRouter", 
    "OracleConfig",
    "OpenOracleClient",
    "get_config",
    "set_config",
    
    # API clients
    "OracleAPI",
    "TwitterAPI", 
    "PollAPI",
    
    # Pure AI routing
    "PureAIRouter",
    "PureAgentRouter",
    
    # LLM Providers
    "LLMProvider",
    "LLMRouter", 
    "BaseLLMProvider",
    "OpenAIProvider",
    "OpenRouterProvider", 
    "WebLLMProvider",
    "ChatMessage",
    "MessageRole",
    "LLMRequest",
    "LLMResponse",
    "TokenUsage",
    "ProviderConfig",
    "create_openai_provider",
    "create_openrouter_provider",
    "create_webllm_provider",
    "create_llm_router",
    "generate_response",
    "generate_json_response",
    
    # Data models and schemas
    "OracleRoutingRequest",
    "OracleRoutingResponse",
    "OracleDataPoint",
    "OraclePollData",
    "AggregatedOracleData",
    "ChainlinkPriceFeed",
    "PythPriceFeed",
    "OracleCapability",
    
    # Oracle providers
    "BaseOracleProvider",
    "ChainlinkProvider",
    "PythProvider",
    "UMAProvider", 
    "BandProvider",
    "API3Provider",
    
    # Enums
    "OracleProvider",
    "DataCategory",
    "UpdateFrequency",
    
    # Exceptions
    "OracleError",
    "RoutingError",
    "ValidationError",
    "ConfigurationError",
    "ProviderError",
    "NetworkError",
    "AuthenticationError",
    "RateLimitError",
    "TimeoutError",
    "DataIntegrityError",
    "UnsupportedOperationError",
    
    # Utilities
    "get_logger",
    "run_async",
    "gather_with_timeout",
    "retry_async",
    
    # Retry utilities
    "RetryConfig",
    "async_retry",
    "sync_retry",
    "retry_decorator",
    "CircuitBreaker",
    "RateLimiter",
    "network_retry",
    "provider_retry",
    "api_retry",
    
    # Cache utilities
    "CacheManager",
    "MemoryCache", 
    "FileCache",
    "create_cache",
    "cache_key_from_request",
    "ttl_from_category",
]

# Package metadata
__meta__ = {
    "name": "openoracle-sdk",
    "version": __version__,
    "description": __description__,
    "author": __author__,
    "license": __license__,
    "python_requires": ">=3.9",
    "homepage": "https://github.com/openoracle/sdk",
    "documentation": "https://docs.openoracle.ai",
    "repository": "https://github.com/openoracle/sdk.git",
}

def get_version() -> str:
    """Get the current version of the OpenOracle SDK."""
    return __version__

def get_info() -> dict[str, str]:
    """Get package information as a dictionary."""
    return __meta__.copy()

# Configure default logging
import logging
logging.getLogger(__name__).addHandler(logging.NullHandler())