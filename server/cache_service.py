"""
DonWatcher Risk Calculation Caching Layer
High-performance caching for risk calculations to reduce database load.

Features:
- In-memory LRU cache with TTL support
- Automatic cache invalidation on data changes
- Cache statistics and monitoring
- Thread-safe operations
"""

import logging
import time
import hashlib
import json
from typing import Any, Dict, Optional, Callable, TypeVar
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from threading import Lock
from collections import OrderedDict
from functools import wraps

logger = logging.getLogger(__name__)

T = TypeVar('T')


@dataclass
class CacheEntry:
    """Single cache entry with metadata."""
    key: str
    value: Any
    created_at: datetime
    expires_at: datetime
    access_count: int = 0
    last_accessed: datetime = field(default_factory=datetime.utcnow)
    
    @property
    def is_expired(self) -> bool:
        """Check if entry has expired."""
        return datetime.utcnow() > self.expires_at
    
    def access(self) -> Any:
        """Access entry and update metadata."""
        self.access_count += 1
        self.last_accessed = datetime.utcnow()
        return self.value


@dataclass
class CacheStats:
    """Cache statistics."""
    hits: int = 0
    misses: int = 0
    evictions: int = 0
    invalidations: int = 0
    total_entries: int = 0
    memory_entries: int = 0
    
    @property
    def hit_rate(self) -> float:
        """Calculate cache hit rate."""
        total = self.hits + self.misses
        return (self.hits / total * 100) if total > 0 else 0.0
    
    def to_dict(self) -> Dict:
        """Convert to dictionary."""
        return {
            'hits': self.hits,
            'misses': self.misses,
            'evictions': self.evictions,
            'invalidations': self.invalidations,
            'total_entries': self.total_entries,
            'hit_rate_percent': round(self.hit_rate, 2)
        }


class RiskCache:
    """
    Thread-safe LRU cache with TTL support for risk calculations.
    
    This cache is optimized for risk calculation results which:
    - Are expensive to compute (DB queries + calculations)
    - Don't change frequently (only on member acceptance changes)
    - Have predictable invalidation patterns (per domain/group)
    """
    
    # Cache configuration
    DEFAULT_TTL_SECONDS = 300  # 5 minutes
    MAX_ENTRIES = 1000
    
    # Cache key prefixes
    PREFIX_GLOBAL_RISK = "global_risk"
    PREFIX_DOMAIN_RISK = "domain_risk"
    PREFIX_GROUP_RISK = "group_risk"
    PREFIX_RISK_BREAKDOWN = "risk_breakdown"
    PREFIX_RISK_HISTORY = "risk_history"
    
    def __init__(self, max_entries: int = None, default_ttl: int = None):
        """
        Initialize cache.
        
        Args:
            max_entries: Maximum number of entries (default: 1000)
            default_ttl: Default TTL in seconds (default: 300)
        """
        self.max_entries = max_entries or self.MAX_ENTRIES
        self.default_ttl = default_ttl or self.DEFAULT_TTL_SECONDS
        
        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self._lock = Lock()
        self._stats = CacheStats()
        
        logger.info(f"RiskCache initialized: max_entries={self.max_entries}, ttl={self.default_ttl}s")
    
    def _make_key(self, prefix: str, *args, **kwargs) -> str:
        """Generate cache key from prefix and arguments."""
        key_parts = [prefix] + [str(a) for a in args]
        if kwargs:
            key_parts.append(hashlib.md5(
                json.dumps(kwargs, sort_keys=True).encode()
            ).hexdigest()[:8])
        return ":".join(key_parts)
    
    def _evict_expired(self) -> int:
        """Remove expired entries. Returns count of evicted entries."""
        evicted = 0
        keys_to_remove = []
        
        for key, entry in self._cache.items():
            if entry.is_expired:
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            del self._cache[key]
            evicted += 1
        
        self._stats.evictions += evicted
        return evicted
    
    def _evict_lru(self) -> None:
        """Evict least recently used entries if over capacity."""
        while len(self._cache) >= self.max_entries:
            # OrderedDict maintains insertion order; first item is oldest
            oldest_key = next(iter(self._cache))
            del self._cache[oldest_key]
            self._stats.evictions += 1
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found/expired
        """
        with self._lock:
            entry = self._cache.get(key)
            
            if entry is None:
                self._stats.misses += 1
                return None
            
            if entry.is_expired:
                del self._cache[key]
                self._stats.misses += 1
                self._stats.evictions += 1
                return None
            
            # Move to end (most recently used)
            self._cache.move_to_end(key)
            self._stats.hits += 1
            
            return entry.access()
    
    def set(self, key: str, value: Any, ttl: int = None) -> None:
        """
        Set value in cache.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: TTL in seconds (default: default_ttl)
        """
        ttl = ttl or self.default_ttl
        now = datetime.utcnow()
        
        with self._lock:
            # Evict if needed
            self._evict_expired()
            self._evict_lru()
            
            entry = CacheEntry(
                key=key,
                value=value,
                created_at=now,
                expires_at=now + timedelta(seconds=ttl)
            )
            
            self._cache[key] = entry
            self._cache.move_to_end(key)
            self._stats.total_entries += 1
    
    def delete(self, key: str) -> bool:
        """
        Delete entry from cache.
        
        Args:
            key: Cache key
            
        Returns:
            True if entry was deleted, False if not found
        """
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                self._stats.invalidations += 1
                return True
            return False
    
    def invalidate_pattern(self, pattern: str) -> int:
        """
        Invalidate all entries matching pattern.
        
        Args:
            pattern: Key pattern to match (prefix)
            
        Returns:
            Number of entries invalidated
        """
        with self._lock:
            keys_to_remove = [
                key for key in self._cache.keys()
                if key.startswith(pattern)
            ]
            
            for key in keys_to_remove:
                del self._cache[key]
            
            self._stats.invalidations += len(keys_to_remove)
            return len(keys_to_remove)
    
    def invalidate_domain(self, domain: str) -> int:
        """
        Invalidate all cache entries for a domain.
        
        Args:
            domain: Domain name
            
        Returns:
            Number of entries invalidated
        """
        patterns = [
            f"{self.PREFIX_GLOBAL_RISK}:{domain}",
            f"{self.PREFIX_DOMAIN_RISK}:{domain}",
            f"{self.PREFIX_GROUP_RISK}:{domain}",
            f"{self.PREFIX_RISK_BREAKDOWN}:{domain}",
            f"{self.PREFIX_RISK_HISTORY}:{domain}",
        ]
        
        total = 0
        for pattern in patterns:
            total += self.invalidate_pattern(pattern)
        
        logger.info(f"Invalidated {total} cache entries for domain {domain}")
        return total
    
    def invalidate_group(self, domain: str, group_name: str) -> int:
        """
        Invalidate cache entries for a specific group.
        
        Args:
            domain: Domain name
            group_name: Group name
            
        Returns:
            Number of entries invalidated
        """
        # Invalidate group-specific entries
        group_pattern = f"{self.PREFIX_GROUP_RISK}:{domain}:{group_name}"
        count = self.invalidate_pattern(group_pattern)
        
        # Also invalidate domain-level entries since they aggregate group data
        count += self.invalidate_domain(domain)
        
        return count
    
    def clear(self) -> int:
        """
        Clear all cache entries.
        
        Returns:
            Number of entries cleared
        """
        with self._lock:
            count = len(self._cache)
            self._cache.clear()
            self._stats.invalidations += count
            logger.info(f"Cache cleared: {count} entries removed")
            return count
    
    def get_stats(self) -> Dict:
        """Get cache statistics."""
        with self._lock:
            self._stats.memory_entries = len(self._cache)
            return self._stats.to_dict()
    
    # Convenience methods for specific cache types
    
    def get_global_risk(self, domain: str) -> Optional[Dict]:
        """Get cached global risk for domain."""
        key = self._make_key(self.PREFIX_GLOBAL_RISK, domain)
        return self.get(key)
    
    def set_global_risk(self, domain: str, data: Dict, ttl: int = None) -> None:
        """Cache global risk for domain."""
        key = self._make_key(self.PREFIX_GLOBAL_RISK, domain)
        self.set(key, data, ttl)
    
    def get_domain_risk(self, domain: str) -> Optional[Dict]:
        """Get cached domain risk assessment."""
        key = self._make_key(self.PREFIX_DOMAIN_RISK, domain)
        return self.get(key)
    
    def set_domain_risk(self, domain: str, data: Dict, ttl: int = None) -> None:
        """Cache domain risk assessment."""
        key = self._make_key(self.PREFIX_DOMAIN_RISK, domain)
        self.set(key, data, ttl)
    
    def get_risk_breakdown(self, domain: str) -> Optional[Dict]:
        """Get cached risk breakdown for domain."""
        key = self._make_key(self.PREFIX_RISK_BREAKDOWN, domain)
        return self.get(key)
    
    def set_risk_breakdown(self, domain: str, data: Dict, ttl: int = None) -> None:
        """Cache risk breakdown for domain."""
        key = self._make_key(self.PREFIX_RISK_BREAKDOWN, domain)
        self.set(key, data, ttl)
    
    def get_risk_history(self, domain: str, days: int) -> Optional[Dict]:
        """Get cached risk history for domain."""
        key = self._make_key(self.PREFIX_RISK_HISTORY, domain, days)
        return self.get(key)
    
    def set_risk_history(self, domain: str, days: int, data: Dict, ttl: int = None) -> None:
        """Cache risk history for domain."""
        key = self._make_key(self.PREFIX_RISK_HISTORY, domain, days)
        self.set(key, data, ttl)


# Global cache instance
_risk_cache: Optional[RiskCache] = None


def get_risk_cache() -> RiskCache:
    """Get or create the global risk cache instance."""
    global _risk_cache
    if _risk_cache is None:
        _risk_cache = RiskCache()
    return _risk_cache


def cached_risk_calculation(
    cache_type: str,
    ttl: int = None,
    key_args: tuple = None
):
    """
    Decorator for caching risk calculations.
    
    Usage:
        @cached_risk_calculation('global_risk', ttl=300)
        async def get_global_risk(domain: str):
            ...
    
    Args:
        cache_type: Type of cache entry (used as prefix)
        ttl: TTL in seconds
        key_args: Tuple of argument names to use for cache key
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            cache = get_risk_cache()
            
            # Build cache key from function arguments
            if key_args:
                key_values = [kwargs.get(k, args[i] if i < len(args) else None) 
                             for i, k in enumerate(key_args)]
            else:
                key_values = list(args) + list(kwargs.values())
            
            cache_key = cache._make_key(cache_type, *key_values)
            
            # Try cache first
            cached = cache.get(cache_key)
            if cached is not None:
                logger.debug(f"Cache hit for {cache_key}")
                return cached
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            cache.set(cache_key, result, ttl)
            logger.debug(f"Cached result for {cache_key}")
            
            return result
        
        return wrapper
    return decorator


def invalidate_risk_cache_for_domain(domain: str) -> int:
    """
    Invalidate all risk cache entries for a domain.
    Called when domain data changes.
    
    Args:
        domain: Domain name
        
    Returns:
        Number of entries invalidated
    """
    cache = get_risk_cache()
    return cache.invalidate_domain(domain)


def invalidate_risk_cache_for_member_change(domain: str, group_name: str) -> int:
    """
    Invalidate cache when member acceptance changes.
    
    Args:
        domain: Domain name
        group_name: Group name
        
    Returns:
        Number of entries invalidated
    """
    cache = get_risk_cache()
    return cache.invalidate_group(domain, group_name)


def get_cache_stats() -> Dict:
    """Get cache statistics for monitoring."""
    cache = get_risk_cache()
    return cache.get_stats()

