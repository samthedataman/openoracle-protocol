"""
Tests for configuration management
"""

import pytest
from unittest.mock import patch
from pathlib import Path
import tempfile
import json

from openoracle.core.config import OracleConfig, ProviderConfig, ChainConfig


class TestOracleConfig:
    """Test oracle configuration"""
    
    def test_default_config(self):
        """Test default configuration creation"""
        config = OracleConfig()
        
        assert config.base_url == "http://localhost:8000"
        assert config.timeout_seconds == 30
        assert config.enable_ai_routing is True
        assert len(config.providers) > 0
        assert len(config.chains) > 0
    
    def test_config_from_env(self):
        """Test configuration from environment variables"""
        env_vars = {
            'OPENORACLE_API_KEY': 'test-api-key',
            'OPENORACLE_BASE_URL': 'https://api.openoracle.ai',
            'OPENROUTER_API_KEY': 'test-router-key',
            'OPENORACLE_TIMEOUT': '60'
        }
        
        with patch.dict('os.environ', env_vars):
            config = OracleConfig.from_env()
            
            assert config.api_key == 'test-api-key'
            assert config.base_url == 'https://api.openoracle.ai'
            assert config.openrouter_api_key == 'test-router-key'
            assert config.timeout_seconds == 60
    
    def test_config_to_dict(self):
        """Test configuration serialization to dictionary"""
        config = OracleConfig(
            api_key='test-key',
            base_url='https://example.com'
        )
        
        config_dict = config.to_dict()
        
        assert config_dict['api_key'] == 'test-key'
        assert config_dict['base_url'] == 'https://example.com'
        assert 'providers' in config_dict
        assert 'chains' in config_dict
    
    def test_config_from_dict(self):
        """Test configuration creation from dictionary"""
        config_data = {
            'api_key': 'test-key',
            'base_url': 'https://example.com',
            'timeout_seconds': 45,
            'providers': {
                'chainlink': {
                    'enabled': True,
                    'api_key': 'chainlink-key'
                }
            }
        }
        
        config = OracleConfig.from_dict(config_data)
        
        assert config.api_key == 'test-key'
        assert config.base_url == 'https://example.com'
        assert config.timeout_seconds == 45
        assert 'chainlink' in config.providers
        assert config.providers['chainlink'].api_key == 'chainlink-key'
    
    def test_config_file_operations(self):
        """Test saving and loading configuration files"""
        config = OracleConfig(
            api_key='test-key',
            base_url='https://example.com'
        )
        
        with tempfile.TemporaryDirectory() as tmpdir:
            config_path = Path(tmpdir) / 'test_config.json'
            
            # Save configuration
            config.save_to_file(str(config_path))
            assert config_path.exists()
            
            # Load configuration
            loaded_config = OracleConfig.from_file(str(config_path))
            assert loaded_config.api_key == 'test-key'
            assert loaded_config.base_url == 'https://example.com'
    
    def test_config_validation(self):
        """Test configuration validation"""
        config = OracleConfig()
        issues = config.validate()
        
        # Should have no issues with default config
        assert len(issues) == 0
        
        # Test invalid configuration
        config.base_url = ""
        issues = config.validate()
        assert len(issues) > 0
        assert any("Base URL" in issue for issue in issues)
    
    def test_provider_config(self):
        """Test provider configuration"""
        provider_config = ProviderConfig(
            enabled=True,
            api_key='test-key',
            timeout_seconds=30,
            retry_attempts=3
        )
        
        assert provider_config.enabled is True
        assert provider_config.api_key == 'test-key'
        assert provider_config.timeout_seconds == 30
        assert provider_config.retry_attempts == 3
    
    def test_chain_config(self):
        """Test chain configuration"""
        chain_config = ChainConfig(
            chain_id=1,
            name="ethereum",
            rpc_url="https://eth.llamarpc.com",
            explorer_url="https://etherscan.io"
        )
        
        assert chain_config.chain_id == 1
        assert chain_config.name == "ethereum"
        assert chain_config.rpc_url == "https://eth.llamarpc.com"
        assert chain_config.explorer_url == "https://etherscan.io"
    
    def test_get_provider_config(self):
        """Test getting specific provider configuration"""
        config = OracleConfig()
        
        chainlink_config = config.get_provider_config('chainlink')
        assert chainlink_config is not None
        assert isinstance(chainlink_config, ProviderConfig)
        
        invalid_config = config.get_provider_config('invalid_provider')
        assert invalid_config is None
    
    def test_get_chain_config(self):
        """Test getting specific chain configuration"""
        config = OracleConfig()
        
        eth_config = config.get_chain_config('ethereum')
        assert eth_config is not None
        assert isinstance(eth_config, ChainConfig)
        assert eth_config.chain_id == 1
        
        invalid_config = config.get_chain_config('invalid_chain')
        assert invalid_config is None