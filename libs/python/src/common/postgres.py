
import logging
from contextlib import asynccontextmanager

import asyncpg

logger = logging.getLogger(__name__)


class PostgresClient:
    """Async PostgreSQL client with single connection."""
    
    def __init__(
        self,
        postgres_url: str,
    ):
        """
        Initialize Postgres client.
        
        Args:
            postgres_url: PostgreSQL connection URL
        """
        self.postgres_url = postgres_url
        self._pool: asyncpg.Pool | None = None
    
    async def connect(self) -> None:
        """Establish database connection."""
        if self._pool is None:
            self._pool = await asyncpg.create_pool(self.postgres_url)
            logger.info("Connected to PostgreSQL")
    
    async def disconnect(self) -> None:
        """Close database connection."""
        if self._pool:
            await self._pool.close()
            self._pool = None
            logger.info("Disconnected from PostgreSQL")
    
    @property
    def pool(self) -> asyncpg.Pool:
        """Get connection instance."""
        if self._pool is None:
            raise RuntimeError("PostgreSQL client not connected. Call connect() first.")
        return self._pool
        
    async def execute(
        self,
        query: str,
        *args,
        timeout: float | None = None,
    ) -> str:
        """
        Execute a query (INSERT, UPDATE, DELETE, DDL).
        
        Example:
            ```python
            await postgres.execute(
                "INSERT INTO users (name, email) VALUES ($1, $2)",
                "John", "john@example.com"
            )
            ```
        """
        return await self.pool.execute(query, *args, timeout=timeout)

    async def fetch(
        self,
        query: str,
        *args,
        timeout: float | None = None,
    ) -> list[asyncpg.Record]:  
        """
        Fetch multiple rows.
        """
        return await self.pool.fetch(query, *args, timeout=timeout)

    async def fetchrow(
        self,
        query: str,
        *args,
        timeout: float | None = None,
    ) -> asyncpg.Record | None:
        """
        Fetch a single row.
        """
        return await self.pool.fetchrow(query, *args, timeout=timeout)
  
    
    @asynccontextmanager
    async def transaction(self):
        """
        Start a transaction (context manager).
        
        Example:
            ```python
            async with postgres.transaction():
                await postgres.execute("INSERT INTO users ...")
                await postgres.execute("INSERT INTO profiles ...")
            ```
        """
        async with self.pool.transaction():
            yield
    