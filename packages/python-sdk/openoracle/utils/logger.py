"""
Logging utilities for OpenOracle SDK
"""

import logging
import sys
from typing import Optional, Dict, Any
from pathlib import Path


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance with the given name"""
    return logging.getLogger(name)


def configure_logging(
    level: str = "INFO",
    format_string: Optional[str] = None,
    log_file: Optional[str] = None,
    include_timestamp: bool = True,
    include_level: bool = True,
    include_name: bool = True
) -> None:
    """
    Configure logging for the OpenOracle SDK
    
    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        format_string: Custom format string
        log_file: Optional file path for file logging
        include_timestamp: Include timestamp in log messages
        include_level: Include log level in messages
        include_name: Include logger name in messages
    """
    
    # Build format string if not provided
    if format_string is None:
        format_parts = []
        
        if include_timestamp:
            format_parts.append("%(asctime)s")
        
        if include_name:
            format_parts.append("%(name)s")
        
        if include_level:
            format_parts.append("%(levelname)s")
        
        format_parts.append("%(message)s")
        format_string = " - ".join(format_parts)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper()))
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, level.upper()))
    console_handler.setFormatter(logging.Formatter(format_string))
    root_logger.addHandler(console_handler)
    
    # Create file handler if requested
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(getattr(logging, level.upper()))
        file_handler.setFormatter(logging.Formatter(format_string))
        root_logger.addHandler(file_handler)
    
    # Configure specific loggers to avoid noise
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("aiohttp").setLevel(logging.WARNING)


class StructuredLogger:
    """Structured logger for better log analysis"""
    
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
    
    def _log_structured(
        self,
        level: int,
        message: str,
        extra_data: Optional[Dict[str, Any]] = None,
        **kwargs
    ):
        """Log with structured data"""
        if extra_data:
            # Merge kwargs into extra_data
            extra_data.update(kwargs)
            
            # Format message with structured data
            structured_msg = f"{message}"
            if extra_data:
                data_str = ", ".join([f"{k}={v}" for k, v in extra_data.items()])
                structured_msg += f" | {data_str}"
            
            self.logger.log(level, structured_msg)
        else:
            self.logger.log(level, message, **kwargs)
    
    def debug(self, message: str, **kwargs):
        """Log debug message with structured data"""
        self._log_structured(logging.DEBUG, message, **kwargs)
    
    def info(self, message: str, **kwargs):
        """Log info message with structured data"""
        self._log_structured(logging.INFO, message, **kwargs)
    
    def warning(self, message: str, **kwargs):
        """Log warning message with structured data"""
        self._log_structured(logging.WARNING, message, **kwargs)
    
    def error(self, message: str, **kwargs):
        """Log error message with structured data"""
        self._log_structured(logging.ERROR, message, **kwargs)
    
    def critical(self, message: str, **kwargs):
        """Log critical message with structured data"""
        self._log_structured(logging.CRITICAL, message, **kwargs)


def get_structured_logger(name: str) -> StructuredLogger:
    """Get a structured logger instance"""
    return StructuredLogger(name)