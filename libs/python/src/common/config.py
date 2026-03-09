import os
from pydantic import BaseModel

class AppConfig(BaseModel):
    """Application configuration model."""
    app_name: str
    debug: bool = False
    version: str = "1.0.0"

class OpenRouterConfig(BaseModel):
    """OpenRouter API configuration model."""
    api_key: str
    base_url: str = "https://openrouter.ai/api/v1"

class PostgresConfig(BaseModel):
    """PostgreSQL database configuration model."""
    host: str
    port: int
    username: str
    password: str
    database: str

    @property
    def url(self) -> str:
        """Construct the PostgreSQL connection URL."""
        return f"postgresql://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"

class RedisConfig(BaseModel):
    """Redis configuration model."""
    host: str
    port: int
    user: str
    password: str
    db: int = 0

    @property
    def url(self) -> str:
        """Construct the Redis connection URL."""
        return f"redis://{self.user}:{self.password}@{self.host}:{self.port}/{self.db}"
    
def load_redis_config() -> RedisConfig:
    """Load Redis configuration from environment variables."""
    return RedisConfig(
        host=os.getenv("REDIS_HOST", "localhost"),
        port=int(os.getenv("REDIS_PORT", 6379)),
        user=os.getenv("REDIS_USER", "default"),
        password=os.getenv("REDIS_PASSWORD", ""),
        db=int(os.getenv("REDIS_DB", 0)),
    )

def load_postgres_config() -> PostgresConfig:
    """Load PostgreSQL configuration from environment variables."""
    return PostgresConfig(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", 5432)),
        username=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", ""),
        database=os.getenv("POSTGRES_DB", "postgres"),
    )

def load_app_config() -> AppConfig:
    """Load application configuration from environment variables."""
    return AppConfig(
        app_name=os.getenv("APP_NAME", "AIHub"),
        debug=os.getenv("DEBUG", "false").lower() == "true",
        version=os.getenv("APP_VERSION", "1.0.0"),
    )

def load_open_router_config() -> OpenRouterConfig:
    """Load OpenRouter API configuration from environment variables."""
    return OpenRouterConfig(
        api_key=os.getenv("OPENROUTER_API_KEY", ""),
        base_url=os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
    )