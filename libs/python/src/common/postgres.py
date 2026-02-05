
import logging
from contextlib import asynccontextmanager

import asyncpg
from asyncpg import Connection

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
        self._conn: Connection | None = None
    
    async def connect(self) -> None:
        """Establish database connection."""
        if self._conn is None:
            self._conn = await asyncpg.connect(self.postgres_url)
            logger.info("Connected to PostgreSQL")
    
    async def disconnect(self) -> None:
        """Close database connection."""
        if self._conn:
            await self._conn.close()
            self._conn = None
            logger.info("Disconnected from PostgreSQL")
    
    @property
    def conn(self) -> Connection:
        """Get connection instance."""
        if self._conn is None:
            raise RuntimeError("PostgreSQL client not connected. Call connect() first.")
        return self._conn
        
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
        return await self.conn.execute(query, *args, timeout=timeout)
  
    
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
        async with self.conn.transaction():
            yield
    