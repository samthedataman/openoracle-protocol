"""
OpenOracle API client and high-level interface
Provides easy-to-use methods for all OpenOracle functionality
"""

from .client import OpenOracleAPI
from .oracle_api import OracleAPI
from .twitter_api import TwitterAPI
from .poll_api import PollAPI

__all__ = [
    'OpenOracleAPI',
    'OracleAPI', 
    'TwitterAPI',
    'PollAPI'
]