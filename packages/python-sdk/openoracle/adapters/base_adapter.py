"""
Base Oracle Adapter for OpenOracle Protocol

This module provides the base interface for all oracle adapters, making it easy
to integrate new oracle providers into the OpenOracle ecosystem.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass
from enum import Enum
import asyncio
import time
import logging

logger = logging.getLogger(__name__)

class DataType(Enum):
    """Supported oracle data types"""
    PRICE = "price"
    WEATHER = "weather" 
    SPORTS = "sports"
    CUSTOM = "custom"
    NEWS = "news"
    SOCIAL = "social"

class ResponseFormat(Enum):
    """Oracle response formats"""
    JSON = "json"
    XML = "xml"
    TEXT = "text"
    BINARY = "binary"

@dataclass
class OracleRequest:
    """Standard oracle request format"""
    query: str
    data_type: DataType
    parameters: Dict[str, Any] = None
    timeout: int = 30
    format: ResponseFormat = ResponseFormat.JSON
    metadata: Dict[str, Any] = None

@dataclass 
class OracleResponse:
    """Standard oracle response format"""
    data: Any
    provider: str
    timestamp: float
    confidence: float = 1.0
    latency_ms: int = 0
    cost: float = 0.0
    metadata: Dict[str, Any] = None
    error: Optional[str] = None

@dataclass
class HealthStatus:
    """Oracle provider health status"""
    is_healthy: bool
    response_time_ms: int
    error_rate: float
    last_error: Optional[str] = None
    uptime_percentage: float = 100.0

class BaseOracleAdapter(ABC):
    """
    Base class for all oracle adapters.
    
    This provides a standard interface that all oracle providers must implement,
    ensuring consistency and making it easy to add new providers.
    """
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.name = self._get_adapter_name()
        self.version = self._get_adapter_version()
        self.supported_data_types = self._get_supported_data_types()
        self._stats = {
            'requests': 0,
            'errors': 0,
            'total_latency': 0,
            'last_error': None
        }
    
    @abstractmethod
    def _get_adapter_name(self) -> str:
        """Return the adapter name (e.g., 'chainlink', 'pyth')"""
        pass
    
    @abstractmethod 
    def _get_adapter_version(self) -> str:
        """Return the adapter version"""
        pass
    
    @abstractmethod
    def _get_supported_data_types(self) -> List[DataType]:
        """Return list of supported data types"""
        pass
    
    @abstractmethod
    async def _execute_query(self, request: OracleRequest) -> Any:
        """Execute the actual oracle query - implement in subclass"""
        pass
    
    async def query(self, request: OracleRequest) -> OracleResponse:
        """
        Execute oracle query with error handling and metrics collection.
        
        Args:
            request: OracleRequest with query details
            
        Returns:
            OracleResponse with results and metadata
        """
        start_time = time.time()
        self._stats['requests'] += 1
        
        try:
            # Validate request
            self._validate_request(request)
            
            # Execute query with timeout
            data = await asyncio.wait_for(
                self._execute_query(request),
                timeout=request.timeout
            )
            
            # Calculate metrics
            latency_ms = int((time.time() - start_time) * 1000)
            self._stats['total_latency'] += latency_ms
            
            return OracleResponse(
                data=data,
                provider=self.name,
                timestamp=time.time(),
                confidence=self._calculate_confidence(data, request),
                latency_ms=latency_ms,
                cost=self._calculate_cost(request),
                metadata=self._get_response_metadata(request)
            )
            
        except Exception as e:
            self._stats['errors'] += 1
            self._stats['last_error'] = str(e)
            
            logger.error(f"Oracle query failed for {self.name}: {e}")
            
            return OracleResponse(
                data=None,
                provider=self.name,
                timestamp=time.time(),
                confidence=0.0,
                latency_ms=int((time.time() - start_time) * 1000),
                error=str(e)
            )
    
    def _validate_request(self, request: OracleRequest) -> None:
        """Validate oracle request format"""
        if not request.query:
            raise ValueError("Query cannot be empty")
        
        if request.data_type not in self.supported_data_types:
            raise ValueError(f"Unsupported data type: {request.data_type}")
    
    def _calculate_confidence(self, data: Any, request: OracleRequest) -> float:
        """Calculate confidence score for response - override in subclass"""
        return 1.0 if data is not None else 0.0
    
    def _calculate_cost(self, request: OracleRequest) -> float:
        """Calculate cost for request - override in subclass"""
        return 0.0
    
    def _get_response_metadata(self, request: OracleRequest) -> Dict[str, Any]:
        """Get response metadata - override in subclass"""
        return {}
    
    async def get_health_status(self) -> HealthStatus:
        """
        Get adapter health status with basic metrics.
        Override in subclass for provider-specific health checks.
        """
        try:
            # Simple health check query
            start_time = time.time()
            await self._health_check_query()
            response_time = int((time.time() - start_time) * 1000)
            
            error_rate = (self._stats['errors'] / max(1, self._stats['requests'])) * 100
            
            return HealthStatus(
                is_healthy=True,
                response_time_ms=response_time,
                error_rate=error_rate,
                last_error=self._stats.get('last_error')
            )
            
        except Exception as e:
            return HealthStatus(
                is_healthy=False,
                response_time_ms=30000,  # Timeout
                error_rate=100.0,
                last_error=str(e)
            )
    
    async def _health_check_query(self) -> Any:
        """Override in subclass for provider-specific health check"""
        return True
    
    def get_stats(self) -> Dict[str, Any]:
        """Get adapter performance statistics"""
        avg_latency = (
            self._stats['total_latency'] / max(1, self._stats['requests'])
            if self._stats['requests'] > 0 else 0
        )
        
        return {
            'name': self.name,
            'version': self.version,
            'requests': self._stats['requests'],
            'errors': self._stats['errors'],
            'success_rate': (1 - (self._stats['errors'] / max(1, self._stats['requests']))) * 100,
            'avg_latency_ms': avg_latency,
            'supported_data_types': [dt.value for dt in self.supported_data_types]
        }
    
    def reset_stats(self) -> None:
        """Reset adapter statistics"""
        self._stats = {
            'requests': 0,
            'errors': 0, 
            'total_latency': 0,
            'last_error': None
        }

class OracleAdapterRegistry:
    """
    Registry for managing oracle adapters.
    
    This makes it easy to register new adapters and route queries
    to the appropriate providers.
    """
    
    def __init__(self):
        self._adapters: Dict[str, BaseOracleAdapter] = {}
        self._logger = logging.getLogger(__name__)
    
    def register_adapter(self, adapter: BaseOracleAdapter) -> None:
        """Register a new oracle adapter"""
        self._adapters[adapter.name] = adapter
        self._logger.info(f"Registered oracle adapter: {adapter.name}")
    
    def unregister_adapter(self, name: str) -> None:
        """Unregister an oracle adapter"""
        if name in self._adapters:
            del self._adapters[name]
            self._logger.info(f"Unregistered oracle adapter: {name}")
    
    def get_adapter(self, name: str) -> Optional[BaseOracleAdapter]:
        """Get adapter by name"""
        return self._adapters.get(name)
    
    def list_adapters(self) -> List[str]:
        """List all registered adapter names"""
        return list(self._adapters.keys())
    
    def get_adapters_for_data_type(self, data_type: DataType) -> List[BaseOracleAdapter]:
        """Get all adapters that support a specific data type"""
        return [
            adapter for adapter in self._adapters.values()
            if data_type in adapter.supported_data_types
        ]
    
    async def query_best_adapter(
        self, 
        request: OracleRequest,
        preferred_adapters: List[str] = None
    ) -> OracleResponse:
        """
        Query the best available adapter for a request.
        
        This provides automatic adapter selection based on:
        - Data type support
        - Adapter health
        - Performance metrics
        """
        available_adapters = self.get_adapters_for_data_type(request.data_type)
        
        if not available_adapters:
            return OracleResponse(
                data=None,
                provider="none",
                timestamp=time.time(),
                confidence=0.0,
                error=f"No adapters available for data type: {request.data_type}"
            )
        
        # Filter by preferred adapters if specified
        if preferred_adapters:
            available_adapters = [
                adapter for adapter in available_adapters
                if adapter.name in preferred_adapters
            ]
        
        # Sort by health and performance
        available_adapters.sort(key=lambda a: (
            a.get_stats()['success_rate'],
            -a.get_stats()['avg_latency_ms']
        ), reverse=True)
        
        # Try adapters in order until one succeeds
        last_error = None
        for adapter in available_adapters:
            try:
                response = await adapter.query(request)
                if response.error is None:
                    return response
                last_error = response.error
            except Exception as e:
                last_error = str(e)
                continue
        
        # All adapters failed
        return OracleResponse(
            data=None,
            provider="failed",
            timestamp=time.time(),
            confidence=0.0,
            error=f"All adapters failed. Last error: {last_error}"
        )

# Global registry instance
oracle_registry = OracleAdapterRegistry()