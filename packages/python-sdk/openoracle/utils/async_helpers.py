"""
Async utility functions for OpenOracle SDK
"""

import asyncio
import functools
from typing import Any, Awaitable, List, Optional, TypeVar, Callable, Union
import logging
import time

logger = logging.getLogger(__name__)

T = TypeVar('T')


def run_async(coro: Awaitable[T]) -> T:
    """
    Run an async coroutine in a sync context
    
    Args:
        coro: The coroutine to run
        
    Returns:
        The result of the coroutine
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If we're already in an async context, we need to use a different approach
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, coro)
                return future.result()
        else:
            return loop.run_until_complete(coro)
    except RuntimeError:
        # No event loop exists, create one
        return asyncio.run(coro)


async def gather_with_timeout(
    *awaitables: Awaitable,
    timeout: float,
    return_exceptions: bool = False
) -> List[Any]:
    """
    Gather multiple awaitables with a timeout
    
    Args:
        *awaitables: Coroutines or awaitables to gather
        timeout: Timeout in seconds
        return_exceptions: Whether to return exceptions instead of raising
        
    Returns:
        List of results from the awaitables
        
    Raises:
        asyncio.TimeoutError: If the timeout is exceeded
    """
    try:
        return await asyncio.wait_for(
            asyncio.gather(*awaitables, return_exceptions=return_exceptions),
            timeout=timeout
        )
    except asyncio.TimeoutError:
        logger.warning(f"gather_with_timeout exceeded {timeout}s timeout")
        raise


async def run_with_timeout(coro: Awaitable[T], timeout: float) -> T:
    """
    Run a coroutine with a timeout
    
    Args:
        coro: The coroutine to run
        timeout: Timeout in seconds
        
    Returns:
        The result of the coroutine
        
    Raises:
        asyncio.TimeoutError: If the timeout is exceeded
    """
    return await asyncio.wait_for(coro, timeout=timeout)


def retry_async(
    max_attempts: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    exceptions: tuple = (Exception,)
) -> Callable:
    """
    Decorator to retry async functions with exponential backoff
    
    Args:
        max_attempts: Maximum number of retry attempts
        delay: Initial delay between retries in seconds
        backoff: Multiplier for delay after each attempt
        exceptions: Tuple of exception types to catch and retry
        
    Returns:
        Decorated function
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            current_delay = delay
            
            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    
                    if attempt == max_attempts - 1:
                        # Last attempt, re-raise the exception
                        logger.error(
                            f"Function {func.__name__} failed after {max_attempts} attempts: {e}"
                        )
                        raise
                    
                    logger.warning(
                        f"Function {func.__name__} failed (attempt {attempt + 1}/{max_attempts}): {e}. "
                        f"Retrying in {current_delay}s..."
                    )
                    
                    await asyncio.sleep(current_delay)
                    current_delay *= backoff
            
            # This should never be reached, but just in case
            if last_exception:
                raise last_exception
            
        return wrapper
    return decorator


class AsyncBatch:
    """Helper class for batching async operations"""
    
    def __init__(self, batch_size: int = 10, delay: float = 0.1):
        """
        Initialize async batch processor
        
        Args:
            batch_size: Number of operations to process concurrently
            delay: Delay between batches in seconds
        """
        self.batch_size = batch_size
        self.delay = delay
    
    async def process(
        self,
        items: List[Any],
        processor: Callable[[Any], Awaitable[Any]],
        return_exceptions: bool = True
    ) -> List[Any]:
        """
        Process items in batches
        
        Args:
            items: Items to process
            processor: Async function to process each item
            return_exceptions: Whether to return exceptions instead of raising
            
        Returns:
            List of results from processing all items
        """
        results = []
        
        for i in range(0, len(items), self.batch_size):
            batch = items[i:i + self.batch_size]
            
            logger.debug(f"Processing batch {i//self.batch_size + 1} ({len(batch)} items)")
            
            # Process current batch
            batch_results = await asyncio.gather(
                *[processor(item) for item in batch],
                return_exceptions=return_exceptions
            )
            
            results.extend(batch_results)
            
            # Add delay between batches (except for the last one)
            if i + self.batch_size < len(items):
                await asyncio.sleep(self.delay)
        
        return results


class AsyncRateLimiter:
    """Rate limiter for async operations"""
    
    def __init__(self, max_calls: int, time_window: float):
        """
        Initialize rate limiter
        
        Args:
            max_calls: Maximum number of calls allowed
            time_window: Time window in seconds
        """
        self.max_calls = max_calls
        self.time_window = time_window
        self.calls = []
        self.lock = asyncio.Lock()
    
    async def acquire(self):
        """Acquire permission to make a call (blocks if rate limit exceeded)"""
        async with self.lock:
            now = time.time()
            
            # Remove old calls outside the time window
            self.calls = [call_time for call_time in self.calls if now - call_time < self.time_window]
            
            # If we're at the limit, wait
            if len(self.calls) >= self.max_calls:
                oldest_call = min(self.calls)
                wait_time = self.time_window - (now - oldest_call)
                
                if wait_time > 0:
                    logger.debug(f"Rate limit exceeded, waiting {wait_time:.2f}s")
                    await asyncio.sleep(wait_time)
                    
                    # Remove the oldest call and try again
                    self.calls = self.calls[1:]
            
            # Record this call
            self.calls.append(now)


def with_rate_limit(max_calls: int, time_window: float):
    """
    Decorator to add rate limiting to async functions
    
    Args:
        max_calls: Maximum calls per time window
        time_window: Time window in seconds
    """
    rate_limiter = AsyncRateLimiter(max_calls, time_window)
    
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            await rate_limiter.acquire()
            return await func(*args, **kwargs)
        return wrapper
    return decorator


async def async_map(
    func: Callable[[Any], Awaitable[Any]],
    items: List[Any],
    max_concurrency: Optional[int] = None
) -> List[Any]:
    """
    Apply an async function to a list of items with optional concurrency control
    
    Args:
        func: Async function to apply to each item
        items: List of items to process
        max_concurrency: Maximum number of concurrent operations
        
    Returns:
        List of results
    """
    if max_concurrency is None:
        # Process all items concurrently
        return await asyncio.gather(*[func(item) for item in items])
    else:
        # Use semaphore to limit concurrency
        semaphore = asyncio.Semaphore(max_concurrency)
        
        async def limited_func(item):
            async with semaphore:
                return await func(item)
        
        return await asyncio.gather(*[limited_func(item) for item in items])


class AsyncContextManager:
    """Base class for async context managers"""
    
    async def __aenter__(self):
        await self.start()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.stop()
    
    async def start(self):
        """Override in subclasses"""
        pass
    
    async def stop(self):
        """Override in subclasses"""
        pass