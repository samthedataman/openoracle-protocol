"""
Caching utilities for OpenOracle SDK
"""

import asyncio
import json
import time
from abc import ABC, abstractmethod
from typing import Any, Optional, Dict, List, Union
from pathlib import Path
import hashlib
import pickle
import logging

logger = logging.getLogger(__name__)


class CacheBackend(ABC):
    """Abstract base class for cache backends"""
    
    @abstractmethod
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        pass
    
    @abstractmethod
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in cache with optional TTL"""
        pass
    
    @abstractmethod
    async def delete(self, key: str) -> bool:
        """Delete key from cache"""
        pass
    
    @abstractmethod
    async def clear(self) -> None:
        """Clear all cache entries"""
        pass
    
    @abstractmethod
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        pass


class MemoryCache(CacheBackend):
    """In-memory cache implementation"""
    
    def __init__(self, max_size: int = 1000, default_ttl: int = 300):
        self.max_size = max_size
        self.default_ttl = default_ttl
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._access_order: List[str] = []
        self._lock = asyncio.Lock()
    
    async def get(self, key: str) -> Optional[Any]:
        async with self._lock:
            if key not in self._cache:
                return None
            
            entry = self._cache[key]
            
            # Check TTL
            if entry['expires_at'] and time.time() > entry['expires_at']:
                await self._remove_key(key)
                return None
            
            # Update access order (LRU)
            if key in self._access_order:
                self._access_order.remove(key)
            self._access_order.append(key)
            
            entry['hits'] += 1
            entry['last_accessed'] = time.time()
            
            return entry['value']
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        async with self._lock:
            expires_at = None
            if ttl is not None:
                expires_at = time.time() + ttl
            elif self.default_ttl:
                expires_at = time.time() + self.default_ttl
            
            # If cache is full, remove LRU item
            if len(self._cache) >= self.max_size and key not in self._cache:
                await self._evict_lru()
            
            self._cache[key] = {
                'value': value,
                'created_at': time.time(),
                'last_accessed': time.time(),
                'expires_at': expires_at,
                'hits': 0,
                'size': self._estimate_size(value)
            }
            
            # Update access order
            if key in self._access_order:
                self._access_order.remove(key)
            self._access_order.append(key)
    
    async def delete(self, key: str) -> bool:
        async with self._lock:
            return await self._remove_key(key)
    
    async def clear(self) -> None:
        async with self._lock:
            self._cache.clear()
            self._access_order.clear()
    
    async def exists(self, key: str) -> bool:
        async with self._lock:
            if key not in self._cache:
                return False
            
            entry = self._cache[key]
            if entry['expires_at'] and time.time() > entry['expires_at']:
                await self._remove_key(key)
                return False
            
            return True
    
    async def _remove_key(self, key: str) -> bool:
        """Remove key from cache and access order"""
        if key in self._cache:
            del self._cache[key]
            if key in self._access_order:
                self._access_order.remove(key)
            return True
        return False
    
    async def _evict_lru(self) -> None:
        """Evict least recently used item"""
        if self._access_order:
            lru_key = self._access_order[0]
            await self._remove_key(lru_key)
    
    def _estimate_size(self, value: Any) -> int:
        """Estimate size of cached value in bytes"""
        try:
            return len(pickle.dumps(value))
        except:
            return len(str(value))
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_hits = sum(entry['hits'] for entry in self._cache.values())
        total_size = sum(entry['size'] for entry in self._cache.values())
        
        return {
            'entries': len(self._cache),
            'max_size': self.max_size,
            'total_hits': total_hits,
            'total_size_bytes': total_size,
            'utilization': len(self._cache) / self.max_size
        }


class FileCache(CacheBackend):
    """File-based cache implementation"""
    
    def __init__(self, cache_dir: str = "./cache", max_size_mb: int = 100):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.max_size_bytes = max_size_mb * 1024 * 1024
        self._lock = asyncio.Lock()
    
    def _get_file_path(self, key: str) -> Path:
        """Get file path for cache key"""
        # Hash the key to avoid filesystem issues
        hashed_key = hashlib.md5(key.encode()).hexdigest()
        return self.cache_dir / f"{hashed_key}.cache"
    
    def _get_metadata_path(self, key: str) -> Path:
        """Get metadata file path for cache key"""
        hashed_key = hashlib.md5(key.encode()).hexdigest()
        return self.cache_dir / f"{hashed_key}.meta"
    
    async def get(self, key: str) -> Optional[Any]:
        file_path = self._get_file_path(key)
        meta_path = self._get_metadata_path(key)
        
        if not file_path.exists() or not meta_path.exists():
            return None
        
        try:
            # Check metadata
            with open(meta_path, 'r') as f:
                metadata = json.load(f)
            
            # Check TTL
            if metadata.get('expires_at') and time.time() > metadata['expires_at']:
                await self.delete(key)
                return None
            
            # Load value
            with open(file_path, 'rb') as f:
                value = pickle.load(f)
            
            # Update access time
            metadata['last_accessed'] = time.time()
            metadata['hits'] = metadata.get('hits', 0) + 1
            
            with open(meta_path, 'w') as f:
                json.dump(metadata, f)
            
            return value
            
        except Exception as e:
            logger.warning(f"Failed to read cache file {file_path}: {e}")
            await self.delete(key)
            return None
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        file_path = self._get_file_path(key)
        meta_path = self._get_metadata_path(key)
        
        try:
            # Write value
            with open(file_path, 'wb') as f:
                pickle.dump(value, f)
            
            # Write metadata
            metadata = {
                'key': key,
                'created_at': time.time(),
                'last_accessed': time.time(),
                'expires_at': time.time() + ttl if ttl else None,
                'hits': 0,
                'size': file_path.stat().st_size
            }
            
            with open(meta_path, 'w') as f:
                json.dump(metadata, f)
            
            # Check if we need to clean up space
            await self._cleanup_if_needed()
            
        except Exception as e:
            logger.error(f"Failed to write cache file {file_path}: {e}")
            # Clean up partial writes
            if file_path.exists():
                file_path.unlink()
            if meta_path.exists():
                meta_path.unlink()
    
    async def delete(self, key: str) -> bool:
        file_path = self._get_file_path(key)
        meta_path = self._get_metadata_path(key)
        
        deleted = False
        
        if file_path.exists():
            file_path.unlink()
            deleted = True
        
        if meta_path.exists():
            meta_path.unlink()
            deleted = True
        
        return deleted
    
    async def clear(self) -> None:
        """Clear all cache files"""
        for file_path in self.cache_dir.glob("*.cache"):
            file_path.unlink()
        
        for meta_path in self.cache_dir.glob("*.meta"):
            meta_path.unlink()
    
    async def exists(self, key: str) -> bool:
        file_path = self._get_file_path(key)
        meta_path = self._get_metadata_path(key)
        
        if not file_path.exists() or not meta_path.exists():
            return False
        
        try:
            with open(meta_path, 'r') as f:
                metadata = json.load(f)
            
            # Check TTL
            if metadata.get('expires_at') and time.time() > metadata['expires_at']:
                await self.delete(key)
                return False
            
            return True
            
        except Exception:
            return False
    
    async def _cleanup_if_needed(self) -> None:
        """Clean up cache if it exceeds size limit"""
        total_size = 0
        cache_files = []
        
        # Collect all cache files with metadata
        for meta_path in self.cache_dir.glob("*.meta"):
            try:
                with open(meta_path, 'r') as f:
                    metadata = json.load(f)
                
                file_path = self._get_file_path(metadata['key'])
                if file_path.exists():
                    cache_files.append((metadata, file_path, meta_path))
                    total_size += metadata.get('size', 0)
                    
            except Exception:
                # Clean up corrupted metadata
                meta_path.unlink(missing_ok=True)
                continue
        
        # If over size limit, remove least recently used files
        if total_size > self.max_size_bytes:
            # Sort by last accessed time (oldest first)
            cache_files.sort(key=lambda x: x[0].get('last_accessed', 0))
            
            for metadata, file_path, meta_path in cache_files:
                file_path.unlink(missing_ok=True)
                meta_path.unlink(missing_ok=True)
                total_size -= metadata.get('size', 0)
                
                if total_size <= self.max_size_bytes * 0.8:  # Leave some buffer
                    break


class CacheManager:
    """High-level cache manager"""
    
    def __init__(
        self,
        backend: CacheBackend,
        key_prefix: str = "openoracle",
        default_ttl: int = 300
    ):
        self.backend = backend
        self.key_prefix = key_prefix
        self.default_ttl = default_ttl
    
    def _make_key(self, key: str) -> str:
        """Create cache key with prefix"""
        return f"{self.key_prefix}:{key}"
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        return await self.backend.get(self._make_key(key))
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in cache"""
        if ttl is None:
            ttl = self.default_ttl
        await self.backend.set(self._make_key(key), value, ttl)
    
    async def delete(self, key: str) -> bool:
        """Delete key from cache"""
        return await self.backend.delete(self._make_key(key))
    
    async def clear(self) -> None:
        """Clear all cache entries"""
        await self.backend.clear()
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        return await self.backend.exists(self._make_key(key))
    
    async def get_or_set(
        self,
        key: str,
        factory_func,
        ttl: Optional[int] = None,
        *args,
        **kwargs
    ) -> Any:
        """Get value from cache or set it using factory function"""
        value = await self.get(key)
        
        if value is not None:
            return value
        
        # Call factory function
        if asyncio.iscoroutinefunction(factory_func):
            value = await factory_func(*args, **kwargs)
        else:
            value = factory_func(*args, **kwargs)
        
        await self.set(key, value, ttl)
        return value
    
    def cached(self, ttl: Optional[int] = None, key_func: Optional[callable] = None):
        """Decorator for caching function results"""
        def decorator(func):
            async def async_wrapper(*args, **kwargs):
                # Generate cache key
                if key_func:
                    cache_key = key_func(*args, **kwargs)
                else:
                    cache_key = f"{func.__name__}:{hash(str(args) + str(kwargs))}"
                
                return await self.get_or_set(
                    cache_key,
                    func,
                    ttl,
                    *args,
                    **kwargs
                )
            
            def sync_wrapper(*args, **kwargs):
                # For sync functions, run in event loop
                if key_func:
                    cache_key = key_func(*args, **kwargs)
                else:
                    cache_key = f"{func.__name__}:{hash(str(args) + str(kwargs))}"
                
                # Check if we're in an async context
                try:
                    loop = asyncio.get_running_loop()
                    return loop.run_until_complete(
                        self.get_or_set(cache_key, func, ttl, *args, **kwargs)
                    )
                except RuntimeError:
                    # No event loop, create one
                    return asyncio.run(
                        self.get_or_set(cache_key, func, ttl, *args, **kwargs)
                    )
            
            if asyncio.iscoroutinefunction(func):
                return async_wrapper
            else:
                return sync_wrapper
        
        return decorator


# Utility functions for common cache patterns
def create_cache(
    cache_type: str = "memory",
    **kwargs
) -> CacheManager:
    """
    Create cache manager with specified backend
    
    Args:
        cache_type: "memory" or "file"
        **kwargs: Backend-specific arguments
    """
    if cache_type == "memory":
        backend = MemoryCache(**kwargs)
    elif cache_type == "file":
        backend = FileCache(**kwargs)
    else:
        raise ValueError(f"Unknown cache type: {cache_type}")
    
    return CacheManager(backend)


def cache_key_from_request(request_data: dict) -> str:
    """Generate cache key from request data"""
    # Sort keys for consistent hashing
    sorted_data = json.dumps(request_data, sort_keys=True)
    return hashlib.md5(sorted_data.encode()).hexdigest()


def ttl_from_category(category: str) -> int:
    """Get TTL based on data category"""
    ttl_map = {
        'price': 60,        # 1 minute for price data
        'crypto': 60,       # 1 minute for crypto data
        'sports': 300,      # 5 minutes for sports data
        'weather': 600,     # 10 minutes for weather data
        'news': 1800,       # 30 minutes for news data
        'economic': 3600,   # 1 hour for economic data
    }
    
    return ttl_map.get(category.lower(), 300)  # Default 5 minutes