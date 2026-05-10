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


class MinioConfig(BaseSettings):
    """MinIO object storage configuration."""
    model_config = SettingsConfigDict(env_prefix="MINIO_", env_file=".env", extra="ignore")

    endpoint: str = "localhost:9000"
    access_key: str = "minioadmin"
    secret_key: str = "minioadmin"
    bucket: str = "default"
    secure: bool = False
    # Public base URL used to build object URLs returned to callers.
    # In production set this to your CDN or reverse-proxy URL.
    public_url: str = "http://localhost:9000"