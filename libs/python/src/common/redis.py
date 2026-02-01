from redis.asyncio import Redis
from redis.asyncio.client import PubSub

import logging

logger = logging.getLogger(__name__)

class RedisClient:
    def __init__(
        self,
        redis_url: str,
    ):
        self._url = redis_url
        self._client: Redis | None = None

    async def connect(self) -> None:
        if self._client is None:
            self._client = Redis.from_url(self._url)
            try:
                await self._client.ping()
                logger.info("Connected to Redis successfully.")
            except Exception as e:
                logger.error(f"Failed to connect to Redis: {e}")
                self._client = None
                raise

        
    async def disconnect(self) -> None:
        if self._client is not None:
            await self._client.close()
            self._client = None

            logger.info("Disconnected from Redis.")

    async def ping(self) -> bool:
        """Check Redis connection."""
        try:
            return await self._client.ping()
        except Exception as e:
            logger.error(f"Redis ping failed: {e}")
            return False
    
    async def get(self, key: str) -> str | None:
        """Get value by key."""
        return await self._client.get(key)
    
    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        """Set value for key."""
        await self._client.set(key, value, ex=ex)

    async def delete(self, key: str) -> None:
        """Delete key."""
        await self._client.delete(key)

    async def publish(self, channel: str, message: str) -> None:
        """Publish message to channel."""
        await self._client.publish(channel, message)

class RedisPubSub:
    def __init__(self, redis_client: RedisClient):
        self.redis_client = redis_client
        self._pubsub: PubSub | None = None
    
