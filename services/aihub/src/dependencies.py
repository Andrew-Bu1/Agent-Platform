from functools import lru_cache
from fastapi import Depends, Request

from common import PostgresClient
from src.domain.registry.model import ModelRegistry
from src.domain.run_time.model_manager import ModelManager
from src.application.services.embedding import EmbeddingService
from src.domain.factories.embedding import EmbedingFactory
from src.application.repositories.model_config import ModelConfigRepository
from src.config import (
    get_settings,
    Settings
)

def get_db(
    request: Request
) -> PostgresClient:
    return request.app.state.db

def get_model_config_repository(
    db: PostgresClient = Depends(get_db)
) -> ModelConfigRepository:
    return ModelConfigRepository(db=db)

@lru_cache
def get_model_registry() -> ModelRegistry:
    registry = ModelRegistry()
    
    registry.register("embedding", EmbedingFactory())
    
    return registry

@lru_cache
def get_model_manager(
    registry: ModelRegistry = Depends(get_model_registry),
    config_repo: ModelConfigRepository = Depends(get_model_config_repository),
) -> ModelManager:
    return ModelManager(model_registry=registry, model_config_repository=config_repo)

from src.application.repositories.model_usage import ModelUsageRepository

def get_model_usage_repository(
    db: PostgresClient = Depends(get_db)
) -> ModelUsageRepository:
    return ModelUsageRepository(db=db)

def get_embedding_service(
    model_manager: ModelManager = Depends(get_model_manager)
) -> EmbeddingService:
    return EmbeddingService(model_manager=model_manager)
