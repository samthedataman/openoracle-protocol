"""
Custom exceptions for OpenOracle SDK
Provides structured error handling for different types of failures
"""

from typing import Optional, Dict, Any, List
from dataclasses import dataclass


class OracleError(Exception):
    """Base exception for all OpenOracle-related errors"""
    
    def __init__(
        self,
        message: str,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.details = details or {}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for API responses"""
        return {
            'error': self.__class__.__name__,
            'message': self.message,
            'error_code': self.error_code,
            'details': self.details
        }


class ConfigurationError(OracleError):
    """Raised when there's an issue with configuration"""
    
    def __init__(
        self,
        message: str,
        config_key: Optional[str] = None,
        validation_errors: Optional[List[str]] = None
    ):
        super().__init__(
            message,
            error_code="CONFIG_ERROR",
            details={
                'config_key': config_key,
                'validation_errors': validation_errors or []
            }
        )
        self.config_key = config_key
        self.validation_errors = validation_errors or []


class ProviderError(OracleError):
    """Raised when an oracle provider fails"""
    
    def __init__(
        self,
        message: str,
        provider_name: str,
        provider_error: Optional[str] = None,
        status_code: Optional[int] = None,
        retry_count: int = 0
    ):
        super().__init__(
            message,
            error_code="PROVIDER_ERROR",
            details={
                'provider': provider_name,
                'provider_error': provider_error,
                'status_code': status_code,
                'retry_count': retry_count
            }
        )
        self.provider_name = provider_name
        self.provider_error = provider_error
        self.status_code = status_code
        self.retry_count = retry_count


class RoutingError(OracleError):
    """Raised when oracle routing fails"""
    
    def __init__(
        self,
        message: str,
        question: Optional[str] = None,
        available_providers: Optional[List[str]] = None,
        routing_reason: Optional[str] = None
    ):
        super().__init__(
            message,
            error_code="ROUTING_ERROR",
            details={
                'question': question,
                'available_providers': available_providers or [],
                'routing_reason': routing_reason
            }
        )
        self.question = question
        self.available_providers = available_providers or []
        self.routing_reason = routing_reason


class ValidationError(OracleError):
    """Raised when data validation fails"""
    
    def __init__(
        self,
        message: str,
        field_name: Optional[str] = None,
        field_value: Any = None,
        validation_rules: Optional[List[str]] = None
    ):
        super().__init__(
            message,
            error_code="VALIDATION_ERROR",
            details={
                'field_name': field_name,
                'field_value': str(field_value) if field_value is not None else None,
                'validation_rules': validation_rules or []
            }
        )
        self.field_name = field_name
        self.field_value = field_value
        self.validation_rules = validation_rules or []


class NetworkError(OracleError):
    """Raised when network communication fails"""
    
    def __init__(
        self,
        message: str,
        endpoint: Optional[str] = None,
        status_code: Optional[int] = None,
        timeout_seconds: Optional[float] = None
    ):
        super().__init__(
            message,
            error_code="NETWORK_ERROR",
            details={
                'endpoint': endpoint,
                'status_code': status_code,
                'timeout_seconds': timeout_seconds
            }
        )
        self.endpoint = endpoint
        self.status_code = status_code
        self.timeout_seconds = timeout_seconds


class DataIntegrityError(OracleError):
    """Raised when oracle data integrity checks fail"""
    
    def __init__(
        self,
        message: str,
        data_source: Optional[str] = None,
        expected_value: Any = None,
        actual_value: Any = None,
        confidence_score: Optional[float] = None
    ):
        super().__init__(
            message,
            error_code="DATA_INTEGRITY_ERROR",
            details={
                'data_source': data_source,
                'expected_value': str(expected_value) if expected_value is not None else None,
                'actual_value': str(actual_value) if actual_value is not None else None,
                'confidence_score': confidence_score
            }
        )
        self.data_source = data_source
        self.expected_value = expected_value
        self.actual_value = actual_value
        self.confidence_score = confidence_score


class AuthenticationError(OracleError):
    """Raised when API authentication fails"""
    
    def __init__(
        self,
        message: str,
        provider: Optional[str] = None,
        auth_method: Optional[str] = None
    ):
        super().__init__(
            message,
            error_code="AUTH_ERROR",
            details={
                'provider': provider,
                'auth_method': auth_method
            }
        )
        self.provider = provider
        self.auth_method = auth_method


class RateLimitError(OracleError):
    """Raised when API rate limits are exceeded"""
    
    def __init__(
        self,
        message: str,
        provider: str,
        rate_limit: Optional[int] = None,
        reset_time: Optional[int] = None,
        retry_after: Optional[int] = None
    ):
        super().__init__(
            message,
            error_code="RATE_LIMIT_ERROR",
            details={
                'provider': provider,
                'rate_limit': rate_limit,
                'reset_time': reset_time,
                'retry_after': retry_after
            }
        )
        self.provider = provider
        self.rate_limit = rate_limit
        self.reset_time = reset_time
        self.retry_after = retry_after


class TimeoutError(OracleError):
    """Raised when operations timeout"""
    
    def __init__(
        self,
        message: str,
        operation: Optional[str] = None,
        timeout_seconds: Optional[float] = None
    ):
        super().__init__(
            message,
            error_code="TIMEOUT_ERROR",
            details={
                'operation': operation,
                'timeout_seconds': timeout_seconds
            }
        )
        self.operation = operation
        self.timeout_seconds = timeout_seconds


class UnsupportedOperationError(OracleError):
    """Raised when an unsupported operation is requested"""
    
    def __init__(
        self,
        message: str,
        operation: str,
        provider: Optional[str] = None,
        supported_operations: Optional[List[str]] = None
    ):
        super().__init__(
            message,
            error_code="UNSUPPORTED_OPERATION",
            details={
                'operation': operation,
                'provider': provider,
                'supported_operations': supported_operations or []
            }
        )
        self.operation = operation
        self.provider = provider
        self.supported_operations = supported_operations or []


class CacheError(OracleError):
    """Raised when cache operations fail"""
    
    def __init__(
        self,
        message: str,
        cache_key: Optional[str] = None,
        operation: Optional[str] = None
    ):
        super().__init__(
            message,
            error_code="CACHE_ERROR",
            details={
                'cache_key': cache_key,
                'operation': operation
            }
        )
        self.cache_key = cache_key
        self.operation = operation


class AIServiceError(OracleError):
    """Raised when AI service operations fail"""
    
    def __init__(
        self,
        message: str,
        model: Optional[str] = None,
        prompt: Optional[str] = None,
        service_error: Optional[str] = None
    ):
        super().__init__(
            message,
            error_code="AI_SERVICE_ERROR",
            details={
                'model': model,
                'prompt': prompt[:100] + '...' if prompt and len(prompt) > 100 else prompt,
                'service_error': service_error
            }
        )
        self.model = model
        self.prompt = prompt
        self.service_error = service_error


# Exception hierarchy for better error handling
RETRYABLE_ERRORS = [
    NetworkError,
    TimeoutError,
    RateLimitError,
    ProviderError  # Some provider errors are retryable
]

PERMANENT_ERRORS = [
    AuthenticationError,
    ValidationError,
    ConfigurationError,
    UnsupportedOperationError
]


def is_retryable_error(error: Exception) -> bool:
    """Check if an error is retryable"""
    return isinstance(error, tuple(RETRYABLE_ERRORS))


def is_permanent_error(error: Exception) -> bool:
    """Check if an error is permanent (not retryable)"""
    return isinstance(error, tuple(PERMANENT_ERRORS))


@dataclass
class ErrorContext:
    """Context information for error reporting and debugging"""
    operation: str
    provider: Optional[str] = None
    question: Optional[str] = None
    request_id: Optional[str] = None
    user_id: Optional[str] = None
    timestamp: Optional[str] = None
    additional_data: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for logging/reporting"""
        return {
            'operation': self.operation,
            'provider': self.provider,
            'question': self.question,
            'request_id': self.request_id,
            'user_id': self.user_id,
            'timestamp': self.timestamp,
            'additional_data': self.additional_data
        }


def format_error_for_user(error: Exception, context: Optional[ErrorContext] = None) -> Dict[str, Any]:
    """Format an error for user-friendly display"""
    if isinstance(error, OracleError):
        base_response = error.to_dict()
    else:
        base_response = {
            'error': 'UnknownError',
            'message': str(error),
            'error_code': 'UNKNOWN_ERROR',
            'details': {}
        }
    
    if context:
        base_response['context'] = context.to_dict()
    
    # Add user-friendly message based on error type
    user_messages = {
        'ConfigurationError': 'Configuration issue detected. Please check your settings.',
        'ProviderError': 'Oracle provider is temporarily unavailable. Please try again later.',
        'RoutingError': 'Unable to find suitable oracle for this question. Please try rephrasing.',
        'ValidationError': 'Invalid input provided. Please check your data and try again.',
        'NetworkError': 'Network connection issue. Please check your internet connection.',
        'AuthenticationError': 'Authentication failed. Please check your API keys.',
        'RateLimitError': 'Rate limit exceeded. Please wait before making more requests.',
        'TimeoutError': 'Request timed out. Please try again later.',
        'UnknownError': 'An unexpected error occurred. Please try again or contact support.'
    }
    
    error_type = base_response.get('error', 'UnknownError')
    base_response['user_message'] = user_messages.get(error_type, user_messages['UnknownError'])
    
    return base_response