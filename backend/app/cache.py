import json
import logging
from time import monotonic
from typing import Any

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.config import get_settings

logger = logging.getLogger(__name__)


class ResponseCache:
    def __init__(self) -> None:
        settings = get_settings()
        self._memory: dict[str, tuple[float, dict[str, Any]]] = {}
        self._client = Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=0.25,
            socket_timeout=0.25,
        )

    async def get(self, key: str) -> dict[str, Any] | None:
        memory_value = self._memory.get(key)
        if memory_value:
            expires_at, value = memory_value
            if expires_at > monotonic():
                return value
            self._memory.pop(key, None)
        try:
            value = await self._client.get(key)
        except RedisError:
            return None
        if not value:
            return None
        parsed = json.loads(value)
        self._memory[key] = (monotonic() + 30, parsed)
        return parsed

    async def set(self, key: str, value: dict[str, Any], ttl_seconds: int = 300) -> None:
        now = monotonic()
        self._memory = {
            cache_key: cached
            for cache_key, cached in self._memory.items()
            if cached[0] > now
        }
        self._memory[key] = (now + ttl_seconds, value)
        try:
            await self._client.set(key, json.dumps(value, ensure_ascii=False), ex=ttl_seconds)
        except RedisError:
            logger.debug("Redis unavailable; response cache skipped", exc_info=True)

    async def ping(self) -> bool:
        try:
            return bool(await self._client.ping())
        except RedisError:
            return False


response_cache = ResponseCache()
