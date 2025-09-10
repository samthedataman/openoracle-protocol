"""
Retry utilities for OpenOracle SDK
"""

import asyncio
import random
import time
from typing import Any, Callable, Optional, Type, Union, List
from functools import wraps
import logging

logger = logging.getLogger(__name__)


class RetryError(Exception):
    """Error raised when all retry attempts are exhausted"""
    def __init__(self, message: str, attempts: int, last_exception: Exception):
        super().__init__(message)
        self.attempts = attempts
        self.last_exception = last_exception


class RetryConfig:
    """Configuration for retry behavior"""
    
    def __init__(
        self,
        max_attempts: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        backoff_factor: float = 2.0,
        jitter: bool = True,
        retriable_exceptions: Optional[List[Type[Exception]]] = None
    ):
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.backoff_factor = backoff_factor
        self.jitter = jitter
        self.retriable_exceptions = retriable_exceptions or [Exception]


def calculate_delay(attempt: int, config: RetryConfig) -> float:
    """Calculate delay for given attempt with exponential backoff"""
    delay = config.base_delay * (config.backoff_factor ** (attempt - 1))
    delay = min(delay, config.max_delay)
    
    if config.jitter:
        # Add jitter to prevent thundering herd
        delay *= (0.5 + random.random() * 0.5)
    
    return delay


def should_retry(exception: Exception, config: RetryConfig) -> bool:
    """Check if exception should trigger a retry"""
    return any(isinstance(exception, exc_type) for exc_type in config.retriable_exceptions)


async def async_retry(
    func: Callable[..., Any],
    *args,
    config: Optional[RetryConfig] = None,
    **kwargs
) -> Any:
    """
    Execute async function with retry logic
    
    Args:
        func: Async function to execute
        *args: Arguments for function
        config: Retry configuration
        **kwargs: Keyword arguments for function
        
    Returns:
        Function result
        
    Raises:
        RetryError: When all retry attempts are exhausted
    """
    if config is None:
        config = RetryConfig()
    
    last_exception = None
    
    for attempt in range(1, config.max_attempts + 1):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            last_exception = e
            
            if not should_retry(e, config):
                logger.warning(f"Non-retriable exception on attempt {attempt}: {e}")
                raise
            
            if attempt == config.max_attempts:
                logger.error(f"All {config.max_attempts} retry attempts exhausted")
                break
            
            delay = calculate_delay(attempt, config)
            logger.warning(
                f"Attempt {attempt} failed: {e}. Retrying in {delay:.2f}s"
            )
            await asyncio.sleep(delay)
    
    raise RetryError(
        f"Failed after {config.max_attempts} attempts",
        config.max_attempts,
        last_exception
    )


def sync_retry(
    func: Callable[..., Any],
    *args,
    config: Optional[RetryConfig] = None,
    **kwargs
) -> Any:
    """
    Execute sync function with retry logic
    
    Args:
        func: Function to execute
        *args: Arguments for function
        config: Retry configuration
        **kwargs: Keyword arguments for function
        
    Returns:
        Function result
        
    Raises:
        RetryError: When all retry attempts are exhausted
    """
    if config is None:
        config = RetryConfig()
    
    last_exception = None
    
    for attempt in range(1, config.max_attempts + 1):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            last_exception = e
            
            if not should_retry(e, config):
                logger.warning(f"Non-retriable exception on attempt {attempt}: {e}")
                raise
            
            if attempt == config.max_attempts:
                logger.error(f"All {config.max_attempts} retry attempts exhausted")
                break
            
            delay = calculate_delay(attempt, config)
            logger.warning(
                f"Attempt {attempt} failed: {e}. Retrying in {delay:.2f}s"
            )
            time.sleep(delay)
    
    raise RetryError(
        f"Failed after {config.max_attempts} attempts",
        config.max_attempts,
        last_exception
    )


def retry_decorator(config: Optional[RetryConfig] = None):
    """
    Decorator for adding retry logic to functions
    
    Args:
        config: Retry configuration
        
    Usage:
        @retry_decorator(RetryConfig(max_attempts=5))
        async def my_function():
            # Your code here
            pass
    """
    if config is None:
        config = RetryConfig()
    
    def decorator(func):
        if asyncio.iscoroutinefunction(func):
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                return await async_retry(func, *args, config=config, **kwargs)
            return async_wrapper
        else:
            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                return sync_retry(func, *args, config=config, **kwargs)
            return sync_wrapper
    
    return decorator


class CircuitBreaker:
    """Circuit breaker pattern for fault tolerance"""
    
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        expected_exception: Type[Exception] = Exception
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        
        self.failure_count = 0
        self.last_failure_time = None
        self.state = 'closed'  # closed, open, half-open
    
    def __call__(self, func):
        """Decorator to apply circuit breaker to function"""
        if asyncio.iscoroutinefunction(func):
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                return await self._execute_async(func, *args, **kwargs)
            return async_wrapper
        else:
            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                return self._execute_sync(func, *args, **kwargs)
            return sync_wrapper
    
    async def _execute_async(self, func, *args, **kwargs):
        """Execute async function with circuit breaker logic"""
        if self.state == 'open':
            if self._should_attempt_reset():
                self.state = 'half-open'
            else:
                raise Exception("Circuit breaker is open")
        
        try:
            result = await func(*args, **kwargs)
            self._on_success()
            return result
        except self.expected_exception as e:
            self._on_failure()
            raise
    
    def _execute_sync(self, func, *args, **kwargs):
        """Execute sync function with circuit breaker logic"""
        if self.state == 'open':
            if self._should_attempt_reset():
                self.state = 'half-open'
            else:
                raise Exception("Circuit breaker is open")
        
        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except self.expected_exception as e:
            self._on_failure()
            raise
    
    def _should_attempt_reset(self) -> bool:
        """Check if circuit breaker should attempt reset"""
        return (
            self.last_failure_time is not None and
            time.time() - self.last_failure_time >= self.recovery_timeout
        )
    
    def _on_success(self):
        """Handle successful execution"""
        self.failure_count = 0
        self.state = 'closed'
    
    def _on_failure(self):
        """Handle failed execution"""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.failure_threshold:
            self.state = 'open'
    
    def get_state(self) -> dict:
        """Get current circuit breaker state"""
        return {
            'state': self.state,
            'failure_count': self.failure_count,
            'last_failure_time': self.last_failure_time
        }


class RateLimiter:
    """Token bucket rate limiter"""
    
    def __init__(self, max_tokens: int, refill_rate: float):
        self.max_tokens = max_tokens
        self.refill_rate = refill_rate  # tokens per second
        self.tokens = max_tokens
        self.last_refill = time.time()
        self._lock = asyncio.Lock()
    
    async def acquire(self, tokens_needed: int = 1) -> bool:
        """
        Acquire tokens from the bucket
        
        Args:
            tokens_needed: Number of tokens to acquire
            
        Returns:
            True if tokens were acquired, False otherwise
        """
        async with self._lock:
            self._refill_tokens()
            
            if self.tokens >= tokens_needed:
                self.tokens -= tokens_needed
                return True
            
            return False
    
    async def wait_for_tokens(self, tokens_needed: int = 1) -> None:
        """
        Wait until tokens are available
        
        Args:
            tokens_needed: Number of tokens to acquire
        """
        while not await self.acquire(tokens_needed):
            # Calculate wait time
            tokens_shortfall = tokens_needed - self.tokens
            wait_time = tokens_shortfall / self.refill_rate
            await asyncio.sleep(min(wait_time, 1.0))  # Max 1 second wait
    
    def _refill_tokens(self):
        """Refill tokens based on elapsed time"""
        now = time.time()
        elapsed = now - self.last_refill
        tokens_to_add = elapsed * self.refill_rate
        
        self.tokens = min(self.max_tokens, self.tokens + tokens_to_add)
        self.last_refill = now
    
    def get_tokens(self) -> float:
        """Get current token count"""
        self._refill_tokens()
        return self.tokens


# Convenience functions for common retry patterns
def network_retry(max_attempts: int = 3) -> RetryConfig:
    """Retry configuration for network operations"""
    from ..core.exceptions import NetworkError, TimeoutError
    
    return RetryConfig(
        max_attempts=max_attempts,
        base_delay=1.0,
        max_delay=30.0,
        backoff_factor=2.0,
        jitter=True,
        retriable_exceptions=[NetworkError, TimeoutError, ConnectionError]
    )


def provider_retry(max_attempts: int = 2) -> RetryConfig:
    """Retry configuration for oracle provider operations"""
    from ..core.exceptions import ProviderError, RateLimitError
    
    return RetryConfig(
        max_attempts=max_attempts,
        base_delay=2.0,
        max_delay=60.0,
        backoff_factor=3.0,
        jitter=True,
        retriable_exceptions=[ProviderError, RateLimitError]
    )


def api_retry(max_attempts: int = 3) -> RetryConfig:
    """Retry configuration for API operations"""
    from ..core.exceptions import NetworkError, RateLimitError
    
    return RetryConfig(
        max_attempts=max_attempts,
        base_delay=0.5,
        max_delay=10.0,
        backoff_factor=2.0,
        jitter=True,
        retriable_exceptions=[NetworkError, RateLimitError]
    )