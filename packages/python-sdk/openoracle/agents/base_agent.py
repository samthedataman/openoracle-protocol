"""
Base Agent class for OpenOracle agents
"""

import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """Base class for all OpenOracle agents"""
    
    def __init__(self, name: str, config: Optional[Dict[str, Any]] = None):
        self.name = name
        self.config = config or {}
        self.created_at = datetime.now()
        self.logger = logging.getLogger(f"openoracle.agents.{name}")
        
    @abstractmethod
    async def process(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Process input data and return results"""
        pass
    
    @abstractmethod
    async def validate_input(self, data: Dict[str, Any]) -> bool:
        """Validate input data"""
        pass
    
    def get_status(self) -> Dict[str, Any]:
        """Get agent status"""
        return {
            'name': self.name,
            'created_at': self.created_at.isoformat(),
            'config': self.config,
            'type': self.__class__.__name__
        }
    
    async def execute(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute agent with error handling"""
        try:
            # Validate input
            if not await self.validate_input(data):
                raise ValueError(f"Invalid input data for {self.name}")
            
            # Process data
            result = await self.process(data)
            
            # Add metadata
            result['agent'] = self.name
            result['processed_at'] = datetime.now().isoformat()
            
            return result
            
        except Exception as e:
            self.logger.error(f"Agent {self.name} failed: {e}")
            return {
                'error': str(e),
                'agent': self.name,
                'failed_at': datetime.now().isoformat()
            }