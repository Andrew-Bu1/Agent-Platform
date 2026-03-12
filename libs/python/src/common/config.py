from pydantic_settings import BaseSettings, SettingsConfigDict
class AppConfig(BaseSettings):
    """Application configuration model."""
    model_config = SettingsConfigDict(env_prefix="APP_", env_file=".env", extra="ignore")

    name: str
    env: str
    version: str = "1.0.0"


class OpenRouterConfig(BaseSettings):
    """OpenRouter API configuration model."""
    model_config = SettingsConfigDict(env_prefix="OPENROUTER_", env_file=".env", extra="ignore")

    api_key: str
    base_url: str = "https://openrouter.ai/api/v1"

class PostgresConfig(BaseSettings):
    """PostgreSQL database configuration model."""
    model_config = SettingsConfigDict(env_prefix="POSTGRES_", env_file=".env", extra="ignore")

    host: str
    port: int
    username: str
    password: str
    database: str

    @property
    def url(self) -> str:
        """Construct the PostgreSQL connection URL."""
        return f"postgresql://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"
    
class RedisConfig(BaseSettings):
    """Redis configuration model."""
    model_config = SettingsConfigDict(env_prefix="REDIS_", env_file=".env", extra="ignore")

    host: str
    port: int
    user: str
    password: str
    db: int = 0

    @property
    def url(self) -> str:
        """Construct the Redis connection URL."""
        return f"redis://{self.user}:{self.password}@{self.host}:{self.port}/{self.db}"