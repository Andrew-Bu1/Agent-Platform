from common.config import (
    AppConfig,
    OpenRouterConfig,
    PostgresConfig,
)

from dataclasses import dataclass

@dataclass
class Settings:
    app: AppConfig
    postgres: PostgresConfig
    open_router: OpenRouterConfig

def load_settings() -> Settings:
    """Load all application settings."""
    return Settings(
        app=AppConfig(),
        postgres=PostgresConfig(),
        open_router=OpenRouterConfig(),
    )