from dataclasses import dataclass

from common.config import AppConfig, PostgresConfig, RedisConfig
from pydantic_settings import BaseSettings, SettingsConfigDict


class IamConfig(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="IAM_", env_file=".env", extra="ignore")

    base_url: str = "http://iam-service:8080"


class ModelConfig(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MODEL_", env_file=".env", extra="ignore")

    dir: str = ".models"


class ProviderConfig(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="PROVIDER_", env_file=".env", extra="ignore")

    # Fernet key for encrypting/decrypting provider API keys stored in DB.
    # Generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    encryption_key: str | None = None


@dataclass
class Settings:
    app: AppConfig
    postgres: PostgresConfig
    redis: RedisConfig
    iam: IamConfig
    model: ModelConfig
    provider: ProviderConfig


def load_settings() -> Settings:
    return Settings(
        app=AppConfig(),
        postgres=PostgresConfig(),
        redis=RedisConfig(),
        iam=IamConfig(),
        model=ModelConfig(),
        provider=ProviderConfig(),
    )
