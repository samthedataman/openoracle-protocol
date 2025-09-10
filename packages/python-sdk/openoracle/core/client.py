"""
HTTP client for OpenOracle API
Handles authentication, retries, and error handling
"""

import asyncio
import json
import logging
from typing import Optional, Dict, Any, Union, List
import aiohttp
from dataclasses import dataclass
from datetime import datetime, timedelta

from .config import OracleConfig, get_config
from .exceptions import (
    NetworkError,
    AuthenticationError,
    RateLimitError,
    TimeoutError,
    ValidationError,
    OracleError
)

logger = logging.getLogger(__name__)


@dataclass
class RequestMetrics:
    """Metrics for API requests"""
    start_time: datetime
    end_time: Optional[datetime] = None
    status_code: Optional[int] = None
    response_size: Optional[int] = None
    retries: int = 0
    error: Optional[str] = None
    
    @property
    def duration_ms(self) -> Optional[float]:
        """Get request duration in milliseconds"""
        if self.start_time and self.end_time:
            return (self.end_time - self.start_time).total_seconds() * 1000
        return None


class OpenOracleClient:
    """HTTP client for OpenOracle API with retry logic and error handling"""
    
    def __init__(self, config: Optional[OracleConfig] = None):
        self.config = config or get_config()
        self.session: Optional[aiohttp.ClientSession] = None
        self.request_metrics: List[RequestMetrics] = []
        self._rate_limit_reset: Optional[datetime] = None
        
    async def __aenter__(self):
        """Async context manager entry"""
        await self.start()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()
    
    async def start(self):
        """Initialize the HTTP session"""
        if self.session is None or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=self.config.timeout_seconds)
            headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'OpenOracle-SDK/0.1.0'
            }
            
            if self.config.api_key:
                headers['Authorization'] = f'Bearer {self.config.api_key}'
            
            self.session = aiohttp.ClientSession(
                timeout=timeout,
                headers=headers,
                connector=aiohttp.TCPConnector(limit=100, limit_per_host=30)
            )
    
    async def close(self):
        """Close the HTTP session"""
        if self.session and not self.session.closed:
            await self.session.close()
            self.session = None
    
    async def get(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None
    ) -> Dict[str, Any]:
        """Make a GET request"""
        return await self._request('GET', endpoint, params=params, headers=headers, timeout=timeout)
    
    async def post(
        self,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None
    ) -> Dict[str, Any]:
        """Make a POST request"""
        return await self._request(
            'POST',
            endpoint,
            data=data,
            json_data=json_data,
            headers=headers,
            timeout=timeout
        )
    
    async def put(
        self,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None
    ) -> Dict[str, Any]:
        """Make a PUT request"""
        return await self._request(
            'PUT',
            endpoint,
            data=data,
            json_data=json_data,
            headers=headers,
            timeout=timeout
        )
    
    async def delete(
        self,
        endpoint: str,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None
    ) -> Dict[str, Any]:
        """Make a DELETE request"""
        return await self._request('DELETE', endpoint, headers=headers, timeout=timeout)
    
    async def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None,
        retry_count: int = 0
    ) -> Dict[str, Any]:
        """Make an HTTP request with retry logic"""
        
        await self.start()  # Ensure session is started
        
        # Check rate limiting
        if self._rate_limit_reset and datetime.utcnow() < self._rate_limit_reset:
            wait_time = (self._rate_limit_reset - datetime.utcnow()).total_seconds()
            raise RateLimitError(
                f"Rate limit exceeded. Try again in {wait_time:.1f} seconds",
                provider="openoracle",
                retry_after=int(wait_time)
            )
        
        url = self._build_url(endpoint)
        request_headers = self._build_headers(headers)
        request_timeout = timeout or self.config.timeout_seconds
        
        metrics = RequestMetrics(start_time=datetime.utcnow())
        
        try:
            # Prepare request data
            request_kwargs = {
                'method': method,
                'url': url,
                'headers': request_headers,
                'timeout': aiohttp.ClientTimeout(total=request_timeout)
            }
            
            if params:
                request_kwargs['params'] = params
            if json_data:
                request_kwargs['json'] = json_data
            elif data:
                request_kwargs['data'] = data
            
            logger.debug(f"Making {method} request to {url}")
            
            async with self.session.request(**request_kwargs) as response:
                metrics.end_time = datetime.utcnow()
                metrics.status_code = response.status
                metrics.retries = retry_count
                
                # Handle different response types
                response_text = await response.text()
                metrics.response_size = len(response_text.encode('utf-8'))
                
                # Handle rate limiting
                if response.status == 429:
                    retry_after = response.headers.get('Retry-After')
                    if retry_after:
                        self._rate_limit_reset = datetime.utcnow() + timedelta(seconds=int(retry_after))
                    raise RateLimitError(
                        "Rate limit exceeded",
                        provider="openoracle",
                        retry_after=int(retry_after) if retry_after else None
                    )
                
                # Handle authentication errors
                if response.status == 401:
                    raise AuthenticationError(
                        "Authentication failed. Please check your API key.",
                        provider="openoracle"
                    )
                
                # Handle client errors (4xx)
                if 400 <= response.status < 500:
                    try:
                        error_data = json.loads(response_text)
                        error_message = error_data.get('message', f"Client error: {response.status}")
                    except (json.JSONDecodeError, KeyError):
                        error_message = f"HTTP {response.status}: {response_text}"
                    
                    if response.status == 422:
                        raise ValidationError(error_message)
                    else:
                        raise OracleError(error_message, error_code=f"HTTP_{response.status}")
                
                # Handle server errors (5xx) - these are retryable
                if response.status >= 500:
                    error_message = f"Server error {response.status}: {response_text}"
                    if retry_count < self.config.providers.get('openoracle', type('obj', (), {'retry_attempts': 3})()).retry_attempts:
                        logger.warning(f"Server error, retrying... (attempt {retry_count + 1})")
                        await asyncio.sleep(2 ** retry_count)  # Exponential backoff
                        return await self._request(
                            method, endpoint, params, data, json_data, headers, timeout, retry_count + 1
                        )
                    else:
                        raise NetworkError(
                            error_message,
                            endpoint=url,
                            status_code=response.status
                        )
                
                # Parse successful response
                try:
                    if response_text.strip():
                        response_data = json.loads(response_text)
                    else:
                        response_data = {}
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse JSON response: {e}")
                    response_data = {'raw_response': response_text}
                
                self.request_metrics.append(metrics)
                return response_data
                
        except aiohttp.ClientTimeout:
            metrics.end_time = datetime.utcnow()
            metrics.error = "timeout"
            self.request_metrics.append(metrics)
            
            if retry_count < self.config.providers.get('openoracle', type('obj', (), {'retry_attempts': 3})()).retry_attempts:
                logger.warning(f"Request timeout, retrying... (attempt {retry_count + 1})")
                await asyncio.sleep(2 ** retry_count)
                return await self._request(
                    method, endpoint, params, data, json_data, headers, timeout, retry_count + 1
                )
            else:
                raise TimeoutError(
                    f"Request timed out after {request_timeout} seconds",
                    operation=f"{method} {endpoint}",
                    timeout_seconds=request_timeout
                )
                
        except aiohttp.ClientError as e:
            metrics.end_time = datetime.utcnow()
            metrics.error = str(e)
            self.request_metrics.append(metrics)
            
            if retry_count < self.config.providers.get('openoracle', type('obj', (), {'retry_attempts': 3})()).retry_attempts:
                logger.warning(f"Network error, retrying... (attempt {retry_count + 1}): {e}")
                await asyncio.sleep(2 ** retry_count)
                return await self._request(
                    method, endpoint, params, data, json_data, headers, timeout, retry_count + 1
                )
            else:
                raise NetworkError(
                    f"Network error: {str(e)}",
                    endpoint=url
                )
    
    def _build_url(self, endpoint: str) -> str:
        """Build full URL from endpoint"""
        base_url = self.config.base_url.rstrip('/')
        endpoint = endpoint.lstrip('/')
        return f"{base_url}/{endpoint}"
    
    def _build_headers(self, additional_headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        """Build request headers"""
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'OpenOracle-SDK/0.1.0'
        }
        
        if self.config.api_key:
            headers['Authorization'] = f'Bearer {self.config.api_key}'
        
        if additional_headers:
            headers.update(additional_headers)
        
        return headers
    
    def get_metrics_summary(self) -> Dict[str, Any]:
        """Get summary of request metrics"""
        if not self.request_metrics:
            return {}
        
        successful_requests = [m for m in self.request_metrics if m.status_code and m.status_code < 400]
        failed_requests = [m for m in self.request_metrics if not m.status_code or m.status_code >= 400]
        
        durations = [m.duration_ms for m in successful_requests if m.duration_ms is not None]
        
        return {
            'total_requests': len(self.request_metrics),
            'successful_requests': len(successful_requests),
            'failed_requests': len(failed_requests),
            'success_rate': len(successful_requests) / len(self.request_metrics) if self.request_metrics else 0,
            'average_duration_ms': sum(durations) / len(durations) if durations else 0,
            'total_retries': sum(m.retries for m in self.request_metrics),
            'total_response_size_bytes': sum(m.response_size or 0 for m in self.request_metrics)
        }
    
    def clear_metrics(self):
        """Clear stored metrics"""
        self.request_metrics.clear()


# Convenience functions for one-off requests
async def get(endpoint: str, params: Optional[Dict[str, Any]] = None, config: Optional[OracleConfig] = None) -> Dict[str, Any]:
    """Make a GET request"""
    async with OpenOracleClient(config) as client:
        return await client.get(endpoint, params)

async def post(endpoint: str, data: Optional[Dict[str, Any]] = None, config: Optional[OracleConfig] = None) -> Dict[str, Any]:
    """Make a POST request"""
    async with OpenOracleClient(config) as client:
        return await client.post(endpoint, json_data=data)

async def put(endpoint: str, data: Optional[Dict[str, Any]] = None, config: Optional[OracleConfig] = None) -> Dict[str, Any]:
    """Make a PUT request"""
    async with OpenOracleClient(config) as client:
        return await client.put(endpoint, json_data=data)

async def delete(endpoint: str, config: Optional[OracleConfig] = None) -> Dict[str, Any]:
    """Make a DELETE request"""
    async with OpenOracleClient(config) as client:
        return await client.delete(endpoint)