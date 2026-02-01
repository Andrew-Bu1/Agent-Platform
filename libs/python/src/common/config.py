from pydantic_settings import BaseSettings, SettingsConfigDict

class RedisSettings(BaseSettings):
    redis_url: str
    
    model_config = SettingsConfigDict(env_prefix="REDIS_")

class PostgresSettings(BaseSettings):
    postgres_url: str 
    
    model_config = SettingsConfigDict(env_prefix="POSTGRES_")

class BaseAppSettings(BaseSettings):
    log_level: str = "INFO"
    
    model_config = SettingsConfigDict(env_prefix="APP_")