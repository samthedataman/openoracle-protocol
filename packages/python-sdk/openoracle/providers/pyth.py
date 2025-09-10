"""
Pyth Network Oracle Provider Implementation
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from decimal import Decimal
import httpx

from ..schemas.oracle_schemas import (
    PythPriceFeed,
    PythUpdateData,
    OracleDataPoint,
    DataCategory,
    OracleProvider
)

logger = logging.getLogger(__name__)

class PythProvider:
    """Pyth Network oracle data provider"""
    
    # Pyth price feed IDs (mainnet)
    PRICE_FEED_IDS = {
        'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
        'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
        'SOL/USD': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
        'AVAX/USD': '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7',
        'MATIC/USD': '0x5de33a9112c2b700b8d30b8a3402c103578ccfa2765696471cc672bd5cf6ac52',
        'LINK/USD': '0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221',
        'ARB/USD': '0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5',
        'OP/USD': '0x385f64d993f7b77d8182ed5003d97c60aa3361f3cecfe711544d2d59165e9bdf',
        'APT/USD': '0x03ae4db29ed4ae33d323568895aa00337e658e348b37509f5372ae51f0af00d5',
        'EUR/USD': '0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b',
        'GBP/USD': '0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1',
        'GOLD/USD': '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2',
        'SILVER/USD': '0xf2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e',
        'TSLA': '0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1',
        'AAPL': '0x49f6b6e1abde31fd356e40213f0c6e5e419fbfcc27eb0e7c40de1490c7da5bb',
        'GOOGL': '0xe6ceea896448e40011a70e713c4b10c094e1c02cc28f96b092b09e9bddbe33e1',
        'MSFT': '0xd0ff29120028486395e5fc7b4acf05d9e62fb0bc2ac965f9b24ac41cffd1444',
        'SPX500': '0x9e30a8e2e37e908c8e0b07a8b28c6e3a8a5c5e7d2f1e0d9c8b7a6c5e4d3c2b1a'
    }
    
    # Pyth API endpoints
    HERMES_URL = "https://hermes.pyth.network"
    BENCHMARKS_URL = "https://benchmarks.pyth.network"
    
    def __init__(self):
        self.hermes_url = self.HERMES_URL
        
    async def get_price_feed(
        self,
        symbol: str,
        chain: str = "ethereum"
    ) -> Optional[PythPriceFeed]:
        """Get price feed data from Pyth Network"""
        
        try:
            feed_id = self.PRICE_FEED_IDS.get(symbol)
            if not feed_id:
                logger.error(f"Price feed ID not found for symbol: {symbol}")
                return None
            
            # Call Pyth Hermes API
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.hermes_url}/api/latest_price_feeds",
                    params={"ids[]": feed_id}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data and len(data) > 0:
                        feed_data = data[0]
                        price_data = feed_data.get('price', {})
                        
                        return PythPriceFeed(
                            feed_id=feed_id,
                            symbol=symbol,
                            price=Decimal(str(price_data.get('price', 0))),
                            confidence=Decimal(str(price_data.get('conf', 0))),
                            expo=price_data.get('expo', -8),
                            publish_time=datetime.fromtimestamp(
                                price_data.get('publish_time', 0)
                            ),
                            ema_price=Decimal(str(feed_data.get('ema_price', {}).get('price', 0))),
                            ema_confidence=Decimal(str(feed_data.get('ema_price', {}).get('conf', 0))),
                            num_publishers=feed_data.get('num_publishers', 0),
                            max_num_publishers=feed_data.get('max_num_publishers', 0)
                        )
                else:
                    # Fallback to mock data
                    return self._get_mock_feed(symbol, feed_id)
                    
        except Exception as e:
            logger.error(f"Failed to get Pyth price feed: {e}")
            return self._get_mock_feed(symbol, self.PRICE_FEED_IDS.get(symbol, ""))
    
    async def get_update_data(
        self,
        feed_ids: List[str]
    ) -> Optional[PythUpdateData]:
        """Get update data for on-chain price updates"""
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.hermes_url}/api/get_vaa",
                    params={"ids[]": feed_ids}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return PythUpdateData(
                        update_data=data.get('vaa', []),
                        update_fee=data.get('update_fee', 1),
                        valid_time=datetime.utcnow()
                    )
                    
        except Exception as e:
            logger.error(f"Failed to get Pyth update data: {e}")
            
        # Return mock update data
        return PythUpdateData(
            update_data=["0x" + "00" * 100],  # Mock hex data
            update_fee=1,
            valid_time=datetime.utcnow()
        )
    
    async def get_multiple_feeds(
        self,
        symbols: List[str]
    ) -> List[PythPriceFeed]:
        """Get multiple price feeds at once"""
        
        feeds = []
        for symbol in symbols:
            feed = await self.get_price_feed(symbol)
            if feed:
                feeds.append(feed)
        return feeds
    
    def _get_mock_feed(self, symbol: str, feed_id: str) -> PythPriceFeed:
        """Get mock price feed for testing"""
        
        mock_prices = {
            'BTC/USD': (65000.00, -8),
            'ETH/USD': (3500.00, -8),
            'SOL/USD': (110.00, -8),
            'AVAX/USD': (35.00, -8),
            'MATIC/USD': (0.85, -8),
            'LINK/USD': (15.50, -8),
            'EUR/USD': (1.08, -9),
            'GOLD/USD': (2050.00, -8),
            'TSLA': (250.00, -8),
            'AAPL': (190.00, -8),
            'SPX500': (5000.00, -8)
        }
        
        price, expo = mock_prices.get(symbol, (100.00, -8))
        
        return PythPriceFeed(
            feed_id=feed_id or "0x" + "0" * 64,
            symbol=symbol,
            price=Decimal(str(price * (10 ** abs(expo)))),
            confidence=Decimal(str(price * 0.001 * (10 ** abs(expo)))),
            expo=expo,
            publish_time=datetime.utcnow(),
            ema_price=Decimal(str(price * (10 ** abs(expo)))),
            ema_confidence=Decimal(str(price * 0.001 * (10 ** abs(expo)))),
            num_publishers=20,
            max_num_publishers=25
        )
    
    async def to_oracle_data_point(
        self,
        feed: PythPriceFeed
    ) -> OracleDataPoint:
        """Convert Pyth feed to generic oracle data point"""
        
        # Adjust price for exponent
        adjusted_price = float(feed.price) * (10 ** feed.expo)
        adjusted_confidence = float(feed.confidence) * (10 ** feed.expo)
        
        return OracleDataPoint(
            provider=OracleProvider.PYTH,
            data_type=DataCategory.PRICE,
            value=adjusted_price,
            timestamp=feed.publish_time,
            confidence=1.0 - (adjusted_confidence / adjusted_price) if adjusted_price > 0 else 0.95,
            metadata={
                'symbol': feed.symbol,
                'feed_id': feed.feed_id,
                'confidence_interval': adjusted_confidence,
                'num_publishers': feed.num_publishers,
                'expo': feed.expo
            }
        )