"""
Configuration management for OpenOracle SDK
Handles API keys, endpoints, and provider settings
"""

import os
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from pathlib import Path
import json
import logging

logger = logging.getLogger(__name__)


@dataclass
class ProviderConfig:
    """Configuration for individual oracle providers"""
    enabled: bool = True
    api_key: Optional[str] = None
    endpoint_url: Optional[str] = None
    timeout_seconds: int = 30
    retry_attempts: int = 3
    rate_limit_per_minute: Optional[int] = None
    custom_params: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ChainConfig:
    """Configuration for blockchain networks"""
    chain_id: int
    name: str
    rpc_url: str
    explorer_url: Optional[str] = None
    native_token: str = "ETH"
    block_time_seconds: float = 12.0


@dataclass
class OracleConfig:
    """Main configuration class for OpenOracle SDK"""
    
    # Core API settings
    base_url: str = "http://localhost:8000"
    api_key: Optional[str] = None
    timeout_seconds: int = 30
    
    # AI routing settings
    openrouter_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    enable_ai_routing: bool = True
    ai_model: str = "gpt-4o-mini"
    ai_temperature: float = 0.1
    
    # Provider configurations
    providers: Dict[str, ProviderConfig] = field(default_factory=dict)
    
    # Supported chains
    chains: Dict[str, ChainConfig] = field(default_factory=dict)
    
    # Cache settings
    enable_caching: bool = True
    cache_ttl_seconds: int = 300
    cache_max_size: int = 1000
    
    # Logging settings
    log_level: str = "INFO"
    enable_debug: bool = False
    
    def __post_init__(self):
        """Initialize default providers and chains if not provided"""
        if not self.providers:
            self.providers = self._get_default_providers()
        
        if not self.chains:
            self.chains = self._get_default_chains()
    
    @classmethod
    def from_env(cls) -> 'OracleConfig':
        """Create configuration from environment variables"""
        config = cls()
        
        # Core settings
        config.base_url = os.getenv('OPENORACLE_BASE_URL', config.base_url)
        config.api_key = os.getenv('OPENORACLE_API_KEY')
        config.timeout_seconds = int(os.getenv('OPENORACLE_TIMEOUT', config.timeout_seconds))
        
        # AI settings
        config.openrouter_api_key = os.getenv('OPENROUTER_API_KEY')
        config.openai_api_key = os.getenv('OPENAI_API_KEY')
        config.enable_ai_routing = os.getenv('OPENORACLE_ENABLE_AI', 'true').lower() == 'true'
        config.ai_model = os.getenv('OPENORACLE_AI_MODEL', config.ai_model)
        
        # Provider settings
        config._load_provider_configs_from_env()
        config._load_chain_configs_from_env()
        
        # Cache settings
        config.enable_caching = os.getenv('OPENORACLE_CACHE_ENABLED', 'true').lower() == 'true'
        config.cache_ttl_seconds = int(os.getenv('OPENORACLE_CACHE_TTL', config.cache_ttl_seconds))
        
        # Logging
        config.log_level = os.getenv('OPENORACLE_LOG_LEVEL', config.log_level)
        config.enable_debug = os.getenv('OPENORACLE_DEBUG', 'false').lower() == 'true'
        
        return config
    
    @classmethod
    def from_file(cls, config_path: str) -> 'OracleConfig':
        """Load configuration from JSON file"""
        path = Path(config_path)
        if not path.exists():
            raise FileNotFoundError(f"Config file not found: {config_path}")
        
        with open(path, 'r') as f:
            config_data = json.load(f)
        
        return cls.from_dict(config_data)
    
    @classmethod
    def from_dict(cls, config_dict: Dict[str, Any]) -> 'OracleConfig':
        """Create configuration from dictionary"""
        config = cls()
        
        for key, value in config_dict.items():
            if hasattr(config, key):
                if key == 'providers':
                    config.providers = {
                        name: ProviderConfig(**provider_data)
                        for name, provider_data in value.items()
                    }
                elif key == 'chains':
                    config.chains = {
                        name: ChainConfig(**chain_data)
                        for name, chain_data in value.items()
                    }
                else:
                    setattr(config, key, value)
        
        return config
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary"""
        return {
            'base_url': self.base_url,
            'api_key': self.api_key,
            'timeout_seconds': self.timeout_seconds,
            'openrouter_api_key': self.openrouter_api_key,
            'openai_api_key': self.openai_api_key,
            'enable_ai_routing': self.enable_ai_routing,
            'ai_model': self.ai_model,
            'ai_temperature': self.ai_temperature,
            'providers': {
                name: {
                    'enabled': provider.enabled,
                    'api_key': provider.api_key,
                    'endpoint_url': provider.endpoint_url,
                    'timeout_seconds': provider.timeout_seconds,
                    'retry_attempts': provider.retry_attempts,
                    'rate_limit_per_minute': provider.rate_limit_per_minute,
                    'custom_params': provider.custom_params
                }
                for name, provider in self.providers.items()
            },
            'chains': {
                name: {
                    'chain_id': chain.chain_id,
                    'name': chain.name,
                    'rpc_url': chain.rpc_url,
                    'explorer_url': chain.explorer_url,
                    'native_token': chain.native_token,
                    'block_time_seconds': chain.block_time_seconds
                }
                for name, chain in self.chains.items()
            },
            'enable_caching': self.enable_caching,
            'cache_ttl_seconds': self.cache_ttl_seconds,
            'cache_max_size': self.cache_max_size,
            'log_level': self.log_level,
            'enable_debug': self.enable_debug
        }
    
    def save_to_file(self, config_path: str):
        """Save configuration to JSON file"""
        path = Path(config_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w') as f:
            json.dump(self.to_dict(), f, indent=2)
    
    def get_provider_config(self, provider_name: str) -> Optional[ProviderConfig]:
        """Get configuration for a specific provider"""
        return self.providers.get(provider_name)
    
    def get_chain_config(self, chain_name: str) -> Optional[ChainConfig]:
        """Get configuration for a specific chain"""
        return self.chains.get(chain_name)
    
    def validate(self) -> List[str]:
        """Validate configuration and return list of issues"""
        issues = []
        
        if not self.base_url:
            issues.append("Base URL is required")
        
        if self.enable_ai_routing and not (self.openrouter_api_key or self.openai_api_key):
            issues.append("AI routing enabled but no AI API key provided")
        
        for name, provider in self.providers.items():
            if provider.enabled and provider.timeout_seconds <= 0:
                issues.append(f"Provider {name} has invalid timeout")
        
        for name, chain in self.chains.items():
            if not chain.rpc_url:
                issues.append(f"Chain {name} missing RPC URL")
            if chain.chain_id <= 0:
                issues.append(f"Chain {name} has invalid chain ID")
        
        return issues
    
    def _load_provider_configs_from_env(self):
        """Load provider configurations from environment variables"""
        # Chainlink
        chainlink_config = ProviderConfig(
            enabled=os.getenv('CHAINLINK_ENABLED', 'true').lower() == 'true',
            api_key=os.getenv('CHAINLINK_API_KEY'),
            endpoint_url=os.getenv('CHAINLINK_ENDPOINT'),
            timeout_seconds=int(os.getenv('CHAINLINK_TIMEOUT', '30')),
            retry_attempts=int(os.getenv('CHAINLINK_RETRIES', '3'))
        )
        self.providers['chainlink'] = chainlink_config
        
        # Pyth
        pyth_config = ProviderConfig(
            enabled=os.getenv('PYTH_ENABLED', 'true').lower() == 'true',
            endpoint_url=os.getenv('PYTH_ENDPOINT', 'https://hermes.pyth.network'),
            timeout_seconds=int(os.getenv('PYTH_TIMEOUT', '10')),
            retry_attempts=int(os.getenv('PYTH_RETRIES', '3'))
        )
        self.providers['pyth'] = pyth_config
        
        # UMA
        uma_config = ProviderConfig(
            enabled=os.getenv('UMA_ENABLED', 'true').lower() == 'true',
            endpoint_url=os.getenv('UMA_ENDPOINT'),
            timeout_seconds=int(os.getenv('UMA_TIMEOUT', '60')),
            retry_attempts=int(os.getenv('UMA_RETRIES', '2'))
        )
        self.providers['uma'] = uma_config
        
        # Band Protocol
        band_config = ProviderConfig(
            enabled=os.getenv('BAND_ENABLED', 'true').lower() == 'true',
            endpoint_url=os.getenv('BAND_ENDPOINT', 'https://laozi1.bandchain.org/api'),
            timeout_seconds=int(os.getenv('BAND_TIMEOUT', '30')),
            retry_attempts=int(os.getenv('BAND_RETRIES', '3'))
        )
        self.providers['band'] = band_config
        
        # API3
        api3_config = ProviderConfig(
            enabled=os.getenv('API3_ENABLED', 'true').lower() == 'true',
            api_key=os.getenv('API3_API_KEY'),
            endpoint_url=os.getenv('API3_ENDPOINT'),
            timeout_seconds=int(os.getenv('API3_TIMEOUT', '30')),
            retry_attempts=int(os.getenv('API3_RETRIES', '3'))
        )
        self.providers['api3'] = api3_config
    
    def _load_chain_configs_from_env(self):
        """Load chain configurations from environment variables"""
        # Ethereum Mainnet
        eth_config = ChainConfig(
            chain_id=1,
            name="ethereum",
            rpc_url=os.getenv('ETH_RPC_URL', 'https://eth.llamarpc.com'),
            explorer_url="https://etherscan.io",
            native_token="ETH",
            block_time_seconds=12.0
        )
        self.chains['ethereum'] = eth_config
        
        # Polygon
        polygon_config = ChainConfig(
            chain_id=137,
            name="polygon",
            rpc_url=os.getenv('POLYGON_RPC_URL', 'https://polygon.llamarpc.com'),
            explorer_url="https://polygonscan.com",
            native_token="MATIC",
            block_time_seconds=2.0
        )
        self.chains['polygon'] = polygon_config
        
        # Flow EVM
        flow_config = ChainConfig(
            chain_id=545,
            name="flow-evm",
            rpc_url=os.getenv('FLOW_RPC_URL', 'https://mainnet.evm.nodes.onflow.org'),
            explorer_url="https://evm.flowscan.org",
            native_token="FLOW",
            block_time_seconds=2.5
        )
        self.chains['flow-evm'] = flow_config
        
        # Arbitrum
        arbitrum_config = ChainConfig(
            chain_id=42161,
            name="arbitrum",
            rpc_url=os.getenv('ARBITRUM_RPC_URL', 'https://arbitrum.llamarpc.com'),
            explorer_url="https://arbiscan.io",
            native_token="ETH",
            block_time_seconds=0.3
        )
        self.chains['arbitrum'] = arbitrum_config
        
        # Base L2
        base_config = ChainConfig(
            chain_id=8453,
            name="base",
            rpc_url=os.getenv('BASE_RPC_URL', 'https://mainnet.base.org'),
            explorer_url="https://basescan.org",
            native_token="ETH",
            block_time_seconds=2.0
        )
        self.chains['base'] = base_config
    
    def _get_default_providers(self) -> Dict[str, ProviderConfig]:
        """Get default provider configurations"""
        return {
            'chainlink': ProviderConfig(
                enabled=True,
                timeout_seconds=30,
                retry_attempts=3
            ),
            'pyth': ProviderConfig(
                enabled=True,
                endpoint_url='https://hermes.pyth.network',
                timeout_seconds=10,
                retry_attempts=3
            ),
            'uma': ProviderConfig(
                enabled=True,
                timeout_seconds=60,
                retry_attempts=2
            ),
            'band': ProviderConfig(
                enabled=True,
                endpoint_url='https://laozi1.bandchain.org/api',
                timeout_seconds=30,
                retry_attempts=3
            ),
            'api3': ProviderConfig(
                enabled=True,
                timeout_seconds=30,
                retry_attempts=3
            )
        }
    
    def _get_default_chains(self) -> Dict[str, ChainConfig]:
        """Get default chain configurations"""
        return {
            'ethereum': ChainConfig(
                chain_id=1,
                name="ethereum",
                rpc_url='https://eth.llamarpc.com',
                explorer_url="https://etherscan.io",
                native_token="ETH",
                block_time_seconds=12.0
            ),
            'polygon': ChainConfig(
                chain_id=137,
                name="polygon",
                rpc_url='https://polygon.llamarpc.com',
                explorer_url="https://polygonscan.com",
                native_token="MATIC",
                block_time_seconds=2.0
            ),
            'base': ChainConfig(
                chain_id=8453,
                name="base",
                rpc_url='https://mainnet.base.org',
                explorer_url="https://basescan.org",
                native_token="ETH",
                block_time_seconds=2.0
            )
        }


# Global configuration instance
_global_config: Optional[OracleConfig] = None


def get_config() -> OracleConfig:
    """Get the global configuration instance"""
    global _global_config
    if _global_config is None:
        _global_config = OracleConfig.from_env()
    return _global_config


def set_config(config: OracleConfig):
    """Set the global configuration instance"""
    global _global_config
    _global_config = config
    
    # Configure logging based on config
    logging.basicConfig(
        level=getattr(logging, config.log_level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )